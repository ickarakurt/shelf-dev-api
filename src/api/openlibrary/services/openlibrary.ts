/**
 * openlibrary service
 */

export default () => ({
  fetchBook: async (isbn: string) => {
    return Promise.resolve({
      title: "The Great Gatsby",
    });
  }
});
