import models from "./models";
import {
  DB_NOT_INIT,
  normalizeAttributes,
  validateData,
  validateId,
  wrapError
} from "./helpers";

const Thread = (models as { Thread?: Loose }).Thread;
const ID_FIELD = "threadID";

export default function createThreadData(_bot: Loose) {
  return {
    async create(threadID: Loose, data: Loose) {
      if (!Thread) {
        return { thread: { threadID: validateId(threadID, ID_FIELD), ...(data || {}) }, created: true };
      }
      try {
        const tid = validateId(threadID, ID_FIELD);
        let thread = await Thread.findOne({ where: { threadID: tid } });
        if (thread) return { thread: thread.get(), created: false };
        thread = await Thread.create({ threadID: tid, ...(data || {}) });
        return { thread: thread.get(), created: true };
      } catch (err) {
        throw wrapError("Failed to create thread", err);
      }
    },

    async get(threadID: Loose) {
      if (!Thread) return null;
      try {
        const tid = validateId(threadID, ID_FIELD);
        const thread = await Thread.findOne({ where: { threadID: tid } });
        return thread ? thread.get() : null;
      } catch (err) {
        throw wrapError("Failed to get thread", err);
      }
    },

    async update(threadID: Loose, data: Loose) {
      if (!Thread) {
        return { thread: { threadID: validateId(threadID, ID_FIELD), ...(data || {}) }, created: false };
      }
      try {
        const tid = validateId(threadID, ID_FIELD);
        validateData(data);
        const thread = await Thread.findOne({ where: { threadID: tid } });
        if (thread) {
          await thread.update(data);
          return { thread: thread.get(), created: false };
        }
        const newThread = await Thread.create({ ...data, threadID: tid });
        return { thread: newThread.get(), created: true };
      } catch (err) {
        throw wrapError("Failed to update thread", err);
      }
    },

    async del(threadID: Loose) {
      if (!Thread) throw new Error(DB_NOT_INIT);
      try {
        const tid = validateId(threadID, ID_FIELD);
        const result = await Thread.destroy({ where: { threadID: tid } });
        if (result === 0) throw new Error("No thread found with the specified threadID");
        return result;
      } catch (err) {
        throw wrapError("Failed to delete thread", err);
      }
    },

    async delAll() {
      if (!Thread) return 0;
      try {
        return await Thread.destroy({ where: {} });
      } catch (err) {
        throw wrapError("Failed to delete all threads", err);
      }
    },

    async getAll(keys: Loose = null) {
      if (!Thread) return [];
      try {
        const attributes = normalizeAttributes(keys);
        const rows = await Thread.findAll({ attributes });
        return rows.map((t: Loose) => t.get());
      } catch (err) {
        throw wrapError("Failed to get all threads", err);
      }
    }
  };
}
