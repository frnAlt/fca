import fs from "node:fs";
import path from "node:path";
import { Sequelize, Transaction } from "sequelize";

import initThreadModel from "./thread";
import initUserModel from "./user";

type ModelsRecord = Record<string, Loose> & {
  sequelize?: Sequelize | null;
  Sequelize?: typeof Sequelize;
  isReady?: boolean;
  syncAll?: () => Promise<void>;
};

let sequelize: Sequelize | null = null;
let models: ModelsRecord = {};

function ensureDatabaseDirectory() {
  const databasePath = path.join(process.cwd(), "Fca_Database");
  if (!fs.existsSync(databasePath)) {
    fs.mkdirSync(databasePath, { recursive: true });
  }
  return databasePath;
}

function attachModel(name: string, model: Loose) {
  if (model && (model as { name?: string }).name) {
    models[name] = model;
  }
}

try {
  const databasePath = ensureDatabaseDirectory();

  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: path.join(databasePath, "database.sqlite"),
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      max: 3
    },
    dialectOptions: {
      timeout: 5000
    },
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
  });

  try {
    attachModel("User", initUserModel(sequelize));
    attachModel("Thread", initThreadModel(sequelize));

    Object.keys(models).forEach((modelName) => {
      try {
        if (models[modelName].associate) {
          models[modelName].associate(models);
        }
      } catch (assocError: unknown) {
        const msg = assocError instanceof Error ? assocError.message : String(assocError);
        console.error(`Failed to associate model ${modelName}:`, msg);
      }
    });
  } catch (loadError: unknown) {
    const msg = loadError instanceof Error ? loadError.message : String(loadError);
    console.error("Failed to load models:", msg);
  }

  models.sequelize = sequelize;
  models.Sequelize = Sequelize;
  models.isReady = true;
  models.syncAll = async () => {
    try {
      if (!sequelize) {
        throw new Error("Sequelize instance not initialized");
      }
      await sequelize.sync({ force: false });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Failed to synchronize models:", msg);
      throw error;
    }
  };
} catch (initError: unknown) {
  const msg = initError instanceof Error ? initError.message : String(initError);
  console.error("Database initialization error:", msg);
  models.sequelize = null;
  models.Sequelize = Sequelize;
  models.isReady = false;
  models.syncAll = async () => {
    throw new Error("Database not initialized");
  };
}

export default models;
