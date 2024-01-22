export default {
  routes: [
    {
      method: "POST",
      path: "/fetch-book",
      handler: "openlibrary.fetchBook",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
