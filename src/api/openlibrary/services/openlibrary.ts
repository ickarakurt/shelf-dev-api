/**
 * openlibrary service
 */

const authorPath = (olId: string) => `https://openlibrary.org/authors/${olId}.json`;
const authorCoverPath = (olId: string) => `https://covers.openlibrary.org/a/olid/${olId}.jpg`;
const bookPath = (olId: string) => `https://openlibrary.org/books/${olId}.json`;
const workPath = (olId: string) => `https://openlibrary.org/works/${olId}.json`;
const getByIsbnPath = (isbn: string) =>  `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;
const editionsPath = (olId: string) => `https://openlibrary.org/works/${olId}/editions.json`;

export default () => ({
  fetchBook: async (olId: string) => {
    const response = await fetch(bookPath(olId));
    const data: any = await response.json();
    return data;
  },
  fetchAuthor: async (olId: string) => {
    const response = await fetch(authorPath(olId));
    const data: any = await response.json();

    const returnData = {
      name: data.name,
      bio: data.bio.value,
      birthDate: data.birth_date,
      cover: authorCoverPath(olId),
    };
    return returnData;
  },
  fetchWork: async (olId: string) => {
    const response = await fetch(workPath(olId));
    const data: any = await response.json();
    return data;
  },
  getByIsbn: async (isbn: string) => {
    const response = await fetch(getByIsbnPath(isbn));
    const data: any = await response.json();
    return data;
  },
  fetchEditions: async (olId: string) => {
    const response = await fetch(editionsPath(olId));
    const data: any = await response.json();
    return data;
  },
});
