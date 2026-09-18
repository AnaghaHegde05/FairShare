// Generates a short, human-typeable invite code, e.g. "7F3K9Q".
// Excludes visually ambiguous characters (0/O, 1/I) to reduce typos when
// a household member reads the code aloud or types it in on another device.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}
