export type NodeStyleCallback<T> = (err?: Loose, data?: T) => void;

export function ensureNodeCallback<T>(callback?: NodeStyleCallback<T>): NodeStyleCallback<T> {
  return typeof callback === "function" ? callback : () => { };
}
