export type AccessProfile = {
  app_role?: string | null;
  job_title?: string | null;
};

const HR_TITLE_PATTERN = /(^|[^a-z])hr([^a-z]|$)|human\s*resources?|human\s*capital|people\s*(?:&|and)\s*culture|personnel/i;

export function isHrJobTitle(jobTitle?: string | null) {
  return HR_TITLE_PATTERN.test(String(jobTitle || "").trim());
}

export function isAdminProfile(profile?: AccessProfile | null) {
  return String(profile?.app_role || "").toLowerCase() === "admin";
}

export function isHrProfile(profile?: AccessProfile | null) {
  const role = String(profile?.app_role || "").toLowerCase();
  return role === "hr" || isHrJobTitle(profile?.job_title);
}

export function canManageWorkforce(profile?: AccessProfile | null) {
  return isAdminProfile(profile) || isHrProfile(profile);
}

export function isManagerProfile(profile?: AccessProfile | null) {
  return String(profile?.app_role || "").toLowerCase() === "manager";
}
