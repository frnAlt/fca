const models = require("./models");
const utils = require("../utils");

let uniqueIndexEnsured = false;

function getBackupModel() {
  if (!models || !models.sequelize || !models.Sequelize) return null;
  const sequelize = models.sequelize;
  const { DataTypes } = models.Sequelize;

  if (sequelize.models && sequelize.models.AppStateBackup) {
    return sequelize.models.AppStateBackup;
  }

  const dialect =
    typeof sequelize.getDialect === "function"
      ? sequelize.getDialect()
      : "sqlite";
  const LongText =
    dialect === "mysql" || dialect === "mariadb"
      ? DataTypes.TEXT("long")
      : DataTypes.TEXT;

  const AppStateBackup = sequelize.define(
    "AppStateBackup",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userID: { type: DataTypes.STRING, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      data: { type: LongText }
    },
    {
      tableName: "app_state_backups",
      timestamps: true,
      indexes: [{ unique: true, fields: ["userID", "type"] }]
    }
  );
  return AppStateBackup;
}

async function ensureUniqueIndex(sequelize) {
  if (uniqueIndexEnsured) return;
  try {
    await sequelize
      .getQueryInterface()
      .addIndex("app_state_backups", ["userID", "type"], {
        unique: true,
        name: "app_state_user_type_unique"
      });
  } catch {}
  uniqueIndexEnsured = true;
}

async function upsertBackup(Model, userID, type, data) {
  const where = { userID: String(userID || ""), type };
  const row = await Model.findOne({ where });
  if (row) {
    await row.update({ data });
    utils.log(`Overwrote existing ${type} backup for user ${where.userID}`);
    return;
  }
  await Model.create({ ...where, data });
  utils.log(`Created new ${type} backup for user ${where.userID}`);
}

async function backupAppStateSQL(jar, userID) {
  try {
    const Model = getBackupModel();
    if (!Model) return;
    await Model.sync();
    await ensureUniqueIndex(models.sequelize);

    const appState = utils.getAppState(jar);
    const cookieStr = cookieHeaderFromJar(jar);

    await upsertBackup(Model, userID, "appstate", JSON.stringify(appState));
    await upsertBackup(Model, userID, "cookie", cookieStr);

    utils.log("AppState backup stored successfully");
  } catch (e) {
    utils.warn(
      `Failed to save AppState backup: ${
        e && e.message ? e.message : String(e)
      }`
    );
  }
}

async function getLatestBackup(userID, type) {
  try {
    const Model = getBackupModel();
    if (!Model) return null;
    const row = await Model.findOne({
      where: { userID: String(userID || ""), type }
    });
    return row ? row.data : null;
  } catch {
    return null;
  }
}

async function getLatestBackupAny(type) {
  try {
    const Model = getBackupModel();
    if (!Model) return null;
    const row = await Model.findOne({
      where: { type },
      order: [["updatedAt", "DESC"]]
    });
    return row ? row.data : null;
  } catch {
    return null;
  }
}

function cookieHeaderFromJar(jar) {
  const urls = ["https://www.facebook.com", "https://www.messenger.com"];
  const seen = new Set();
  const parts = [];
  for (const url of urls) {
    let cookieString = "";
    try {
      if (typeof jar.getCookieStringSync === "function") {
        cookieString = jar.getCookieStringSync(url);
      }
    } catch {}
    if (!cookieString) continue;
    for (const kv of cookieString.split(";")) {
      const trimmed = kv.trim();
      const name = trimmed.split("=")[0];
      if (!name || seen.has(name)) continue;
      seen.add(name);
      parts.push(trimmed);
    }
  }
  return parts.join("; ");
}

async function hydrateJarFromDB(jar, userID) {
  try {
    const { normalizeCookieHeaderString, setJarFromPairs, setJarFromCookies } = require("../utils/formatters/value/formatCookie");
    
    let cookieHeader = null;
    let appStateJson = null;

    if (userID) {
      cookieHeader = await getLatestBackup(userID, "cookie");
      appStateJson = await getLatestBackup(userID, "appstate");
    } else {
      cookieHeader = await getLatestBackupAny("cookie");
      appStateJson = await getLatestBackupAny("appstate");
    }

    if (cookieHeader) {
      const pairs = normalizeCookieHeaderString(cookieHeader);
      if (pairs.length) {
        setJarFromPairs(jar, pairs);
        return true;
      }
    }

    if (appStateJson) {
      let parsed = null;
      try {
        parsed = JSON.parse(appStateJson);
      } catch {}
      if (Array.isArray(parsed)) {
        setJarFromCookies(jar, parsed);
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

module.exports = {
  getBackupModel,
  ensureUniqueIndex,
  upsertBackup,
  backupAppStateSQL,
  getLatestBackup,
  getLatestBackupAny,
  hydrateJarFromDB,
  cookieHeaderFromJar
};
