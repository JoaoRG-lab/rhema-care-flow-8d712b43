export const ULTIMATE_USER_EMAIL = "joaooz123@gmail.com";

export function isUltimateUserEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === ULTIMATE_USER_EMAIL;
}

