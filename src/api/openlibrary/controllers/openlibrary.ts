/**
 * A set of functions called "actions" for `openlibrary`
 */

export default {
  async fetchBook(ctx, next) {
    try {
      const data = await strapi
        .service("api::openlibrary.openlibrary")
        .fetchBook();

      const authorData = await strapi
        .service("api::openlibrary.openlibrary")
        .fetchAuthor("OL2653686A");
      console.log(authorData, "data");

      ctx.body = authorData;
    } catch (err) {
      ctx.badRequest("Fetch book controller error", { moreDetails: err });
    }
  },
};
