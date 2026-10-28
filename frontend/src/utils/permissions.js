export function hasRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

export function canManageEvents(user) {
  return hasRole(user, 'ADMIN') || hasRole(user, 'ORGANIZER');
}
