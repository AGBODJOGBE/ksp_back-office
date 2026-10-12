module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Le scope est la zone touchée : home, auth, api, ui, seo, ci…
    'scope-empty': [1, 'never'],
  },
};
