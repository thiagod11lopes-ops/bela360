import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config';
import { AppError } from '../../common/errors';

const router: Router = Router();

function requireAuth(req: Request) {
  if (!req.user?.businessId) {
    throw new AppError('Não autenticado', 401);
  }
  return req.user;
}

function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

// List all products
router.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = requireAuth(req);
    const { category, lowStock, search } = req.query;

    const where: Record<string, unknown> = { businessId, isActive: true };

    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { brand: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    if (lowStock === 'true') {
      return ok(
        res,
        products.filter(p => Number(p.currentStock) <= Number(p.minStock))
      );
    }

    return ok(res, products);
  } catch (error) {
    next(error);
  }
});

// Get single product
router.get('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = requireAuth(req);
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: { id, businessId },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { name: true } } },
        },
        serviceProducts: {
          include: { service: { select: { name: true } } },
        },
      },
    });

    if (!product) {
      throw new AppError('Produto não encontrado', 404);
    }

    return ok(res, product);
  } catch (error) {
    next(error);
  }
});

// Create product
router.post('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = requireAuth(req);
    const data = req.body;

    if (!data?.name) {
      throw new AppError('Nome do produto é obrigatório', 400);
    }

    // Frontend may send FOR_SALE; schema uses RESALE
    const category =
      data.category === 'FOR_SALE' ? 'RESALE' : data.category || 'INTERNAL_USE';

    const initialStock = Number(data.initialStock || 0);
    const costPrice = Number(data.costPrice || 0);

    const product = await prisma.product.create({
      data: {
        businessId,
        name: data.name,
        brand: data.brand,
        description: data.description,
        sku: data.sku || null,
        barcode: data.barcode,
        category,
        costPrice,
        salePrice: data.salePrice != null ? Number(data.salePrice) : null,
        currentStock: initialStock,
        minStock: Number(data.minStock || 0),
        unit: data.unit || 'un',
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
        imageUrl: data.imageUrl,
      },
    });

    if (initialStock > 0) {
      await prisma.stockMovement.create({
        data: {
          businessId,
          productId: product.id,
          type: 'PURCHASE',
          quantity: initialStock,
          previousStock: 0,
          newStock: initialStock,
          unitCost: costPrice,
          totalCost: costPrice * initialStock,
          notes: 'Estoque inicial',
          userId: req.user!.userId,
        },
      });
    }

    return ok(res, product, 201);
  } catch (error) {
    next(error);
  }
});

// Update product
router.put('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = requireAuth(req);
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) {
      throw new AppError('Produto não encontrado', 404);
    }

    const category =
      data.category === 'FOR_SALE'
        ? 'RESALE'
        : data.category === 'RESALE' || data.category === 'INTERNAL_USE' || data.category === 'BOTH'
          ? data.category
          : undefined;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        brand: data.brand,
        description: data.description,
        sku: data.sku,
        barcode: data.barcode,
        ...(category ? { category } : {}),
        costPrice: data.costPrice != null ? Number(data.costPrice) : undefined,
        salePrice: data.salePrice != null ? Number(data.salePrice) : undefined,
        minStock: data.minStock != null ? Number(data.minStock) : undefined,
        unit: data.unit,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
        imageUrl: data.imageUrl,
        isActive: data.isActive,
      },
    });

    return ok(res, product);
  } catch (error) {
    next(error);
  }
});

// Stock movement
router.post('/products/:id/movement', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId, userId } = requireAuth(req);
    const { id } = req.params;
    const { type, quantity, unitCost, notes, appointmentId } = req.body;

    const product = await prisma.product.findFirst({
      where: { id, businessId },
    });

    if (!product) {
      throw new AppError('Produto não encontrado', 404);
    }

    const qty = Number(quantity);
    if (!type || !qty) {
      throw new AppError('Tipo e quantidade são obrigatórios', 400);
    }

    const isIncoming = ['PURCHASE', 'RETURN'].includes(type) || (type === 'ADJUSTMENT' && qty > 0);
    const quantityChange = isIncoming ? Math.abs(qty) : -Math.abs(qty);
    const newStock = Number(product.currentStock) + quantityChange;

    if (newStock < 0) {
      throw new AppError('Estoque insuficiente', 400);
    }

    const cost = unitCost != null ? Number(unitCost) : Number(product.costPrice);

    const [movement, updatedProduct] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          businessId,
          productId: id,
          type,
          quantity: quantityChange,
          previousStock: Number(product.currentStock),
          newStock,
          unitCost: cost,
          totalCost: cost * Math.abs(qty),
          notes,
          appointmentId,
          userId,
        },
      }),
      prisma.product.update({
        where: { id },
        data: { currentStock: newStock },
      }),
    ]);

    return ok(res, { movement, product: updatedProduct }, 201);
  } catch (error) {
    next(error);
  }
});

// Link product to service
router.post(
  '/products/:productId/services/:serviceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAuth(req);
      const { productId, serviceId } = req.params;
      const { quantityUsed } = req.body;

      const serviceProduct = await prisma.serviceProduct.upsert({
        where: { serviceId_productId: { serviceId, productId } },
        create: { serviceId, productId, quantityUsed: Number(quantityUsed || 1) },
        update: { quantityUsed: Number(quantityUsed || 1) },
      });

      return ok(res, serviceProduct);
    } catch (error) {
      next(error);
    }
  }
);

// Remove product from service
router.delete(
  '/products/:productId/services/:serviceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireAuth(req);
      const { productId, serviceId } = req.params;

      await prisma.serviceProduct.delete({
        where: { serviceId_productId: { serviceId, productId } },
      });

      return ok(res, { message: 'Vínculo removido' });
    } catch (error) {
      next(error);
    }
  }
);

// Get low stock alerts
router.get('/alerts/low-stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = requireAuth(req);

    const products = await prisma.product.findMany({
      where: { businessId, isActive: true },
    });

    const lowStock = products.filter(p => Number(p.currentStock) <= Number(p.minStock));
    const expiringSoon = products.filter(p => {
      if (!p.expirationDate) return false;
      const daysUntilExpiry = Math.ceil(
        (p.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    });

    return ok(res, { lowStock, expiringSoon });
  } catch (error) {
    next(error);
  }
});

// Inventory stats
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = requireAuth(req);

    const [products, movements] = await Promise.all([
      prisma.product.findMany({
        where: { businessId, isActive: true },
      }),
      prisma.stockMovement.findMany({
        where: {
          businessId,
          createdAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) },
        },
      }),
    ]);

    const totalProducts = products.length;
    const lowStockCount = products.filter(
      p => Number(p.currentStock) <= Number(p.minStock)
    ).length;
    const totalStockValue = products.reduce(
      (sum, p) => sum + Number(p.currentStock) * Number(p.costPrice),
      0
    );

    const purchaseTotal = movements
      .filter(m => m.type === 'PURCHASE')
      .reduce((sum, m) => sum + Number(m.totalCost || 0), 0);
    const usageTotal = movements
      .filter(m => m.type === 'SERVICE_USE')
      .reduce((sum, m) => sum + Math.abs(Number(m.totalCost || 0)), 0);

    const consumptionByProduct = movements
      .filter(m => m.type === 'SERVICE_USE')
      .reduce(
        (acc, m) => {
          acc[m.productId] = (acc[m.productId] || 0) + Math.abs(Number(m.quantity));
          return acc;
        },
        {} as Record<string, number>
      );

    const topConsumed = Object.entries(consumptionByProduct)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([productId, quantity]) => ({
        product: products.find(p => p.id === productId),
        quantity,
      }));

    return ok(res, {
      totalProducts,
      lowStockCount,
      totalStockValue,
      monthlyPurchases: purchaseTotal,
      monthlyUsage: usageTotal,
      topConsumed,
    });
  } catch (error) {
    next(error);
  }
});

// Stock movement history
router.get('/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = requireAuth(req);
    const { productId, type, startDate, endDate, limit = '50' } = req.query;

    const where: Record<string, unknown> = { businessId };
    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate as string);
      if (endDate) createdAt.lte = new Date(endDate as string);
      where.createdAt = createdAt;
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      include: {
        product: { select: { name: true, unit: true } },
        user: { select: { name: true } },
      },
    });

    return ok(res, movements);
  } catch (error) {
    next(error);
  }
});

export const inventoryRoutes: Router = router;
