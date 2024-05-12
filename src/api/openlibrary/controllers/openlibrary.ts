/**
 * A set of functions called "actions" for `openlibrary`
 */

export default {
  async fetchBook(ctx, next) {
    const { root } = ctx.request.body;

    if (!root) {
      console.log("🚀 ~ fetchBook ~ root:", root)
      ctx.badRequest("Missing root");
      return;
    }

    try {
      const data = await strapi
        .service("api::openlibrary.openlibrary")
        .allFetchAndSave(root);
      ctx.body = data;
    } catch (err) {
      ctx.badRequest("Fetch book controller error", { moreDetails: err });
    }
  },
};
