export const hasRole = (user, role) => user?.roles?.includes(role) || false;
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');

export function filterUsers(users, { query = '', role = '', verified = '', status = '' }) {
  const search = normalize(query.trim());
  return users.filter((user) => (!search || normalize(`${user.fullName} ${user.email}`).includes(search))
    && (!role || hasRole(user, role))
    && (!verified || user.emailVerified === (verified === 'true'))
    && (!status || user.status === status));
}

export function organizerRoles(user, grant) {
  const roles = new Set(user.roles);
  if (grant) roles.add('ORGANIZER');
  else roles.delete('ORGANIZER');
  if (!roles.size) roles.add('USER');
  return [...roles];
}

export function userStats(users) {
  return [users.length, users.filter((user) => hasRole(user, 'ORGANIZER')).length,
    users.filter((user) => hasRole(user, 'USER') && !hasRole(user, 'ORGANIZER') && !hasRole(user, 'ADMIN')).length];
}
