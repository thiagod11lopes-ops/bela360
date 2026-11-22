const jwt = require("jsonwebtoken");
const token = jwt.sign(
  { userId: "cmws2b7870001m4rbgpgrfji9", businessId: "cmws2b7850000m4rb8b9x3rv1", role: "OWNER" },
  process.env.JWT_SECRET || "bela360_dev_jwt_secret_key_32chars_min",
  { expiresIn: "7d" }
);
console.log(token);