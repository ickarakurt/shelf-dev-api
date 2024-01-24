/**
 * A set of functions called "actions" for `openlibrary`
 */

export default {
  async fetchBook(ctx, next) {
    const { isbn } = ctx.request.query;

    if (!isbn) {
      ctx.badRequest("Missing isbn");
      return;
    }

    try {
      const data = await strapi
        .service("api::openlibrary.openlibrary")
        .allFetchAndSave(isbn);
      ctx.body = data;
    } catch (err) {
      ctx.badRequest("Fetch book controller error", { moreDetails: err });
    }
  },
};
