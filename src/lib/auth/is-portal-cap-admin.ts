/** Admin da empresa ou operador da plataforma (acesso a rotas de admin no portal). */
export function isPortalCapAdminRole (role: string | null | undefined): boolean {
  return role === 'admin' || role === 'platform_admin'
}
