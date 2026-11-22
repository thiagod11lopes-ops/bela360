'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Users,
  Star,
  Send,
  Plus,
  Crown,
  UserPlus,
  Clock,
  Gift,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import {
  marketingApi,
  Campaign,
  SegmentsOverview,
} from '@/lib/api';

type SegmentOverview = SegmentsOverview;

const segmentInfo = {
  ALL: { name: 'Todos', icon: Users, color: 'bg-gray-100 text-gray-600' },
  VIP: { name: 'VIP', icon: Crown, color: 'bg-yellow-100 text-yellow-600' },
  NEW: { name: 'Novos', icon: UserPlus, color: 'bg-green-100 text-green-600' },
  LOYAL: { name: 'Fiéis', icon: Star, color: 'bg-purple-100 text-purple-600' },
  INACTIVE: { name: 'Inativos', icon: Clock, color: 'bg-red-100 text-red-600' },
  BIRTHDAY_MONTH: { name: 'Aniversariantes', icon: Gift, color: 'bg-pink-100 text-pink-600' },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  SCHEDULED: { label: 'Agendada', color: 'bg-blue-100 text-blue-700' },
  SENDING: { label: 'Enviando', color: 'bg-yellow-100 text-yellow-700' },
  COMPLETED: { label: 'Concluída', color: 'bg-green-100 text-green-700' },
};

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<SegmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingStats, setRatingStats] = useState({ average: 0, total: 0 });
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    segmentType: 'ALL',
    scheduledDate: '',
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignsData, segmentsData, ratingsData] = await Promise.all([
        marketingApi.getCampaigns(),
        marketingApi.getSegmentsOverview(),
        marketingApi.getRatingStats(),
      ]);
      setCampaigns(campaignsData);
      setSegments(segmentsData);
      setRatingStats({
        average: Number(ratingsData.averageRating?.toFixed?.(1) ?? ratingsData.averageRating ?? 0),
        total: ratingsData.totalRatings || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados de marketing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCloseModal = () => {
    setShowNewCampaign(false);
    setFormData({ name: '', message: '', segmentType: 'ALL', scheduledDate: '' });
  };

  const getRecipientCount = (segmentType: string): number => {
    if (!segments) return 0;
    const segmentMap: Record<string, keyof SegmentOverview> = {
      ALL: 'all',
      NEW: 'new',
      LOYAL: 'loyal',
      INACTIVE: 'inactive',
      VIP: 'vip',
      BIRTHDAY_MONTH: 'birthdayMonth',
    };
    return segments[segmentMap[segmentType]] || 0;
  };

  const handleSubmitCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.message) {
      alert('Nome e mensagem sao obrigatorios');
      return;
    }

    setSaving(true);
    try {
      const created = await marketingApi.createCampaign({
        name: formData.name,
        message: formData.message,
        segmentType: formData.segmentType,
        scheduledFor: formData.scheduledDate || undefined,
      });

      if (!formData.scheduledDate) {
        await marketingApi.startCampaign(created.id);
      }

      handleCloseModal();
      await loadData();
      alert(formData.scheduledDate ? 'Campanha agendada com sucesso!' : 'Campanha iniciada!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar campanha');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-purple-500" />
            Marketing
          </h1>
          <p className="text-muted-foreground">
            Campanhas, segmentação de clientes e avaliações
          </p>
        </div>

        <button
          onClick={() => setShowNewCampaign(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nova Campanha
        </button>
      </div>

      {/* Rating Stats */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80">Avaliação Média</p>
            <div className="flex items-center gap-2 mt-1">
              <Star className="h-8 w-8 fill-white" />
              <span className="text-4xl font-bold">{ratingStats.average}</span>
              <span className="text-white/80">/ 5.0</span>
            </div>
            <p className="text-sm text-white/80 mt-1">
              Baseado em {ratingStats.total} avaliações
            </p>
          </div>
          <div className="text-right">
            <TrendingUp className="h-12 w-12 text-white/30" />
          </div>
        </div>
      </div>

      {/* Segments */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Segmentos de Clientes</h2>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Object.entries(segmentInfo).map(([key, info]) => {
            const Icon = info.icon;
            const segmentMap: Record<string, keyof SegmentOverview> = {
              ALL: 'all',
              NEW: 'new',
              LOYAL: 'loyal',
              INACTIVE: 'inactive',
              VIP: 'vip',
              BIRTHDAY_MONTH: 'birthdayMonth',
            };
            const count = segments?.[segmentMap[key]] || 0;

            return (
              <div key={key} className="bg-card rounded-lg border p-4 text-center">
                <div className={`inline-flex p-3 rounded-lg ${info.color} mb-2`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">{info.name}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Campaigns */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Campanhas Recentes</h2>
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">Campanha</th>
                <th className="text-left p-4 font-medium">Segmento</th>
                <th className="text-left p-4 font-medium">Destinatários</th>
                <th className="text-left p-4 font-medium">Progresso</th>
                <th className="text-left p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const segment = segmentInfo[campaign.segmentType as keyof typeof segmentInfo];
                const SegmentIcon = segment?.icon || Users;
                const status = statusLabels[campaign.status];
                const progress = campaign.totalRecipients > 0
                  ? (campaign.sentCount / campaign.totalRecipients) * 100
                  : 0;

                return (
                  <tr key={campaign.id} className="border-t hover:bg-muted/30">
                    <td className="p-4">
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${segment?.color}`}>
                          <SegmentIcon className="h-4 w-4" />
                        </div>
                        <span className="text-sm">{segment?.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm">
                        {campaign.sentCount} / {campaign.totalRecipients}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="w-24">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {progress.toFixed(0)}%
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status?.color}`}>
                        {status?.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {campaigns.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma campanha criada ainda
            </div>
          )}
        </div>
      </div>

      {/* New Campaign Modal */}
      {showNewCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Nova Campanha</h2>
            <form onSubmit={handleSubmitCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome da campanha *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Promocao de Verao"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Segmento de clientes</label>
                <select
                  value={formData.segmentType}
                  onChange={(e) => setFormData(prev => ({ ...prev, segmentType: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {Object.entries(segmentInfo).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.name} ({getRecipientCount(key)} clientes)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mensagem *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Digite a mensagem que sera enviada aos clientes..."
                  rows={4}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {'{nome}'} para personalizar com o nome do cliente
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Agendar envio (opcional)</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe vazio para enviar imediatamente
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Resumo da campanha:</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sera enviada para <span className="font-bold">{getRecipientCount(formData.segmentType)}</span> clientes
                  do segmento <span className="font-bold">{segmentInfo[formData.segmentType as keyof typeof segmentInfo]?.name}</span>
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border text-muted-foreground rounded-lg hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Criando...' : formData.scheduledDate ? 'Agendar Campanha' : 'Enviar Agora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
