export function miniAppLaunchUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const launchUrl = new URL("/app/launch", baseUrl);
  launchUrl.searchParams.set("next", normalizedPath);
  return launchUrl.toString();
}
