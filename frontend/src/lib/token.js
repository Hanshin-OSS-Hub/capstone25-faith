const TOKEN_KEY = "faith_access_token";

export const tokenStorage = {
  get() {
    return localStorage.getItem(TOKEN_KEY);
  },

  set(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  remove() {
    localStorage.removeItem(TOKEN_KEY);
  },

  isLoggedIn() {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};
