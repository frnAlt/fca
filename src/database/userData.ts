import models from "./models";
import {
  DB_NOT_INIT,
  normalizeAttributes,
  normalizePayload,
  validateData,
  validateId,
  wrapError
} from "./helpers";

const User = (models as { User?: Loose }).User;
const ID_FIELD = "userID";

function stubUser(userID: string, data: Loose) {
  return { user: { userID, ...normalizePayload(data || {}, "data") }, created: true };
}

export default function createUserData(_bot: Loose) {
  return {
    async create(userID: Loose, data: Loose) {
      if (!User) return stubUser(validateId(userID, ID_FIELD), data);
      try {
        const uid = validateId(userID, ID_FIELD);
        validateData(data);
        const payload = normalizePayload(data, "data");
        let user = await User.findOne({ where: { userID: uid } });
        if (user) return { user: user.get(), created: false };
        user = await User.create({ userID: uid, ...payload });
        return { user: user.get(), created: true };
      } catch (err) {
        throw wrapError("Failed to create user", err);
      }
    },

    async get(userID: Loose) {
      if (!User) return null;
      try {
        const uid = validateId(userID, ID_FIELD);
        const user = await User.findOne({ where: { userID: uid } });
        return user ? user.get() : null;
      } catch (err) {
        throw wrapError("Failed to get user", err);
      }
    },

    async update(userID: Loose, data: Loose) {
      if (!User)
        return {
          user: { userID: validateId(userID, ID_FIELD), ...normalizePayload(data || {}, "data") },
          created: false
        };
      try {
        const uid = validateId(userID, ID_FIELD);
        validateData(data);
        const payload = normalizePayload(data, "data");
        const user = await User.findOne({ where: { userID: uid } });
        if (user) {
          await user.update(payload);
          return { user: user.get(), created: false };
        }
        const newUser = await User.create({ userID: uid, ...payload });
        return { user: newUser.get(), created: true };
      } catch (err) {
        throw wrapError("Failed to update user", err);
      }
    },

    async del(userID: Loose) {
      if (!User) throw new Error(DB_NOT_INIT);
      try {
        const uid = validateId(userID, ID_FIELD);
        const result = await User.destroy({ where: { userID: uid } });
        if (result === 0) throw new Error("No user found with the specified userID");
        return result;
      } catch (err) {
        throw wrapError("Failed to delete user", err);
      }
    },

    async delAll() {
      if (!User) return 0;
      try {
        return await User.destroy({ where: {} });
      } catch (err) {
        throw wrapError("Failed to delete all users", err);
      }
    },

    async getAll(keys: Loose = null) {
      if (!User) return [];
      try {
        const attributes = normalizeAttributes(keys);
        const rows = await User.findAll({ attributes });
        return rows.map((u: Loose) => u.get());
      } catch (err) {
        throw wrapError("Failed to get all users", err);
      }
    }
  };
}
