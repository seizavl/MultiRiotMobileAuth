export interface Account {
  name: string;
  seed: string;
}

export interface LoginTokens {
  cookies: Record<string, string>;
  csrfToken: string;
  idToken: string;
}
