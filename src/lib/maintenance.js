export const READ_ONLY_MODE = process.env.NEXT_PUBLIC_READ_ONLY_MODE !== "false";

export function assertMutationsAllowed() {
  if (READ_ONLY_MODE) {
    throw new Error("A Liga Master está em manutenção e opera temporariamente em modo somente leitura.");
  }
}
