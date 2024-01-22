/**
 * A set of functions called "actions" for `openlibrary`
 */

export default {
  async fetchBook(ctx, next) {
    try {
      const data = await strapi
        .service("api::openlibrary.openlibrary")
        .fetchBook();
      console.log(data, "data");

      ctx.body = data;
    } catch (err) {
      ctx.badRequest("Fetch book controller error", { moreDetails: err });
    }
  },
};
