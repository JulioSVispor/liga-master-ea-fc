export function isStrongPassword(password) {
  return typeof password === "string"
    && password.length >= 8
    && /[A-Za-z]/.test(password)
    && /\d/.test(password);
}
