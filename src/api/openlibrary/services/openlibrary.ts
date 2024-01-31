import axios from "axios";
import sizeOf from "buffer-image-size";
import fs from "fs";
import https from "https";
import path from "path";

const ADMIN_ID = 1;

// At request level
const agent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * utils
 */
function slugify(str: string): string {
  str = str.replace(/^\s+|\s+$/g, ''); // trim
  str = str.toLowerCase();
  
  // remove accents, swap ñ for n, etc
  let from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  let to   = "aaaaeeeeiiiioooouuuunc------";
  for (let i=0, l=from.length ; i<l ; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return str;
}

const upload = async (imgPath) => {
  const ext = path.extname(imgPath).slice(1);
  const name = path.basename(imgPath);
  const buffer = fs.readFileSync(imgPath);
  const dimentions = sizeOf(buffer);
  const uploadProvider = strapi.plugin("upload").service("provider");
  const config = strapi.config.get("plugin.upload");

  const entity = {
    name,
    hash: `${slugify(name)}`,
    size: buffer.length, // buffer.length gives the size in bytes
    type: `image/${ext}`,
    // @ts-ignore
    provider: config.provider,
    caption: name,
    alternativeText: name,
    ext: `.${ext}`,
    mime: `image/${ext}`,
    width: dimentions.width,
    height: dimentions.height,
    createdBy: ADMIN_ID,
    updatedBy: ADMIN_ID,
    folderPath: '/',
    getStream: () => fs.createReadStream(imgPath), // create a readable stream
  };
  try {
    await uploadProvider.upload(entity);
    const result = await strapi.query("plugin::upload.file").create({ data: entity });
    return result;
  } catch (error) {
    console.info("🚀 ~ upload ~ error:", error)
    return null
  }
};

/**
 * Paths
 */

const authorPath = (olId: string) => `https://openlibrary.org/authors/${olId}.json`;
const authorCoverPath = (olId: string) => `https://covers.openlibrary.org/a/olid/${olId}.jpg`;
const bookPath = (olId: string) => `https://openlibrary.org/books/${olId}.json?jscmd=data`;
const workPath = (olId: string) => `https://openlibrary.org/works/${olId}.json?jscmd=details`;
const getByIsbnPath = (isbn: string) =>  `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;
const editionsPath = (olId: string) => `https://openlibrary.org/works/${olId}/editions.json`;
const bookCover = (olId: string) => `https://covers.openlibrary.org/b/id/${olId}-L.jpg`; //

const getBook = async (olId: string): Promise<any>=> {
  const response = await fetch(bookPath(olId));
  const data: any = await response.json();
  return data;
}

const getAuthor = async (olId: string): Promise<Author> => {
  const response = await fetch(authorPath(olId));
  const data: any = await response.json();

  return {
    biography: data.bio?.value || '',
    name: data.name,
    birthDate: data.birth_date || 1990,
    slug: slugify(data.name),
    photo: authorCoverPath(olId),
  }
}

const getWork = async (olId: string) => {
  const response = await fetch(workPath(olId));
  const data: any = await response.json();
  return data;
}

const getByIsbn = async (isbn: string) => {
  const response = await fetch(getByIsbnPath(isbn));
  const data: any = await response.json();
  return data;
}

const getEditions = async (olId: string) => {
  const response = await fetch(editionsPath(olId));
  const data: any = await response.json();
  return data;
}

const saveSubject = async (name: string) => {
  try {
    const createdSubject = await strapi.entityService.create('api::subject.subject', {
        data: {
          name: name,
          slug: slugify(name),
          description: ''
        }
    });
    return createdSubject;
  } catch (error) {
    let subject = await strapi.entityService.findMany('api::subject.subject', {
      filters: {
        name: name,
      }
    });
    return subject[0];
  }
}

const setActiveEditions = async (bookId, editionIds) => {
  console.info("🚀 ~ setActiveEditions ~ bookId, editionIds:", {bookId, editionIds})
  try {
    const updatedBook = await strapi.entityService.update('api::book.book', bookId, {
      data: {
        editions: editionIds,
        activeEdition: editionIds[0],
      }
    });
    return updatedBook;
  } catch (error) {
    console.info("🚀 ~ setActiveEditions ~ error:", error)
    return null;
  }
}

const download = async (url) => {
  // get the filename such as `image01.jpg`
  const name = path.basename(url);
  // we need to set a file path on our host where the image will be
  // downloaded to
  const filePath = `/tmp/${name}`;
  // create an instance of fs.writeStream
  const writeStream = fs.createWriteStream(filePath);
  // make a GET request and create a readStream to the resource
  const { data } = await axios.get(url, {
    responseType: "stream",
    httpsAgent: agent,
  });

  // pipe the data we receive to the writeStream
  data.pipe(writeStream);
  // return a new Promise that resolves when the event writeStream.on
  // is emitted. Resolves the file path

  return new Promise((resolve, reject) => {
    writeStream.on("finish", () => {
      resolve(filePath);
    });
    writeStream.on("error", reject);
  });
};

const saveAuthor = (author: Author) => {
  return strapi.entityService.create('api::author.author',{
    data: {
      name: author.name,
      biography: author.biography,
      birthDate: new Date(author.birthDate).getFullYear(),
      slug: author.slug,
      photo: author.photo
    },
  });
}

const saveBook = async (book: Book) => {
  try {
    const createdBook = await strapi.entityService.create('api::book.book', {
      data: {
        name: book.name,
        slug: book.slug,
        summary: book.summary,
        authors: book.authors,
        subjects: book.subjects,
        originalPublicationDate: new Date(book.originalPublicationDate)
      }
    });
    return createdBook
  } catch (error) {
    console.info("🚀 ~ saveBook ~ error:", error)
    const savedBook = await strapi.entityService.findMany('api::book.book', {
      filters: {
        slug: book.slug,
      }
    });
    return savedBook[0];
  }
}

const saveEdition = async (edition: Edition) => {
  try {
    const savedEdition = await strapi.entityService.create('api::edition.edition', {
      data: {
        isbn10: edition.isbn10,
        isbn13: edition.isbn13,
        editionTitle: edition.editionTitle,
        editionDescription: edition.editionDescription,
        pageCount: edition.pageCount,
        publicationDate: edition.publicationDate ? new Date(String(edition.publicationDate)) : undefined,
        cover: edition.cover
      }
    });
    return savedEdition;
  } catch (error) {
    const savedEdition = await strapi.entityService.findMany('api::edition.edition', {
      filters: {
        $or: [
          { isbn10: edition.isbn10 },
          { isbn13: edition.isbn13 },
        ]
      }
    });
    return savedEdition[0];
  }
}

async function processAuthors(authors: string[]) {
    const authorPromises = authors.map(async author => {
        const authorData = await getAuthor(author);
        try {
            const coverPath = await download(authorData.photo);
            const uploadResponse = await upload(coverPath);
            const createdAuthor = await saveAuthor({ ...authorData, photo: uploadResponse.id });
            console.info('Author saved');
            return createdAuthor;
        } catch (error) {
            console.log("🚀 ~ authorPromises ~ error:", error)
            const author = await strapi.entityService.findMany('api::author.author', {
                filters: {
                    slug: authorData.slug,
                }
            });
            return author[0];
        }
    });

    const savedAuthors = await Promise.all(authorPromises);
    return savedAuthors.filter(author => author !== null); // This filters out any null values in case of errors
}

async function processEditions(editionsData: any) {
  const processEdition = async (edition) => {
    try {
      const editionKey = edition.key.split('/')[2];
      const editionData = await getBook(editionKey);
      const coverPhoto = editionData.covers?.length > 0 ? bookCover(editionData.covers[0]) : "https://covers.openlibrary.org/b/id/12476847-L.jpg"
      const coverPath = await download(coverPhoto);
      const uploadResponse = await upload(coverPath);

      const editionToSave = {
        isbn10: editionData.isbn_10?.length > 0 ? editionData.isbn_10[0] : undefined,
        isbn13: editionData.isbn_13?.length > 0 ? editionData.isbn_13[0] : undefined,
        editionTitle: editionData.title,
        editionDescription: editionData.subtitle,
        pageCount: editionData.number_of_pages,
        publicationDate: editionData.publish_date,
        cover: uploadResponse.id,
      };

      const savedEdition = await saveEdition(editionToSave);
      return savedEdition;
    } catch (error) {
      console.error(`Failed to process edition ${edition.key}: ${error}`);
      return null; // Return null or handle the error as required
    }
  };

  const editionsPromises = editionsData.entries.map(processEdition);
  const savedEditions = await Promise.all(editionsPromises);
  return savedEditions.filter(edition => edition !== null); // Filter out any null values due to errors
}

export default () => ({
  allFetchAndSave: async (isbn: string) => {
    const data = await getByIsbn(isbn);
    const bookData = data[`ISBN:${isbn}`];
    const bookKey = bookData.key.split('/')[2];
    const book = await getBook(bookKey);
    const workKey = book.works[0].key.split('/')[2];

    const savedAuthors = await processAuthors(bookData.authors.map(author => author.url.split('/')[4]));
    const savedSubjects = await Promise.all(bookData.subjects.map(async (subject) => {
      return saveSubject(subject.name);
    }));

    const bookToSave: Book = {
      name: bookData.title,
      slug: slugify(bookData.title),
      summary: bookData.subtitle,
      authors: savedAuthors.map(author => author.id as number),
      subjects: savedSubjects.map(subject => subject.id),
      originalPublicationDate: bookData.publish_date,
    }

    const savedBook = await saveBook(bookToSave);
    const editionsData = await getEditions(workKey);
    const savedEditions = await processEditions(editionsData);
    await setActiveEditions(savedBook.id, savedEditions.map(edition => edition.id));

    return {
      authors: savedAuthors,
      subjects: savedSubjects,
      book: savedBook,
      editions: savedEditions,
      activeEdition: savedEditions[0],
    }
  }
});

// types to use in the service

export interface Author {
  name: string;
  biography: string;
  birthDate: string;
  photo: string;
  slug: string;
  books?: number[];
}

export interface Book {
  name: string;
  slug: string;
  summary: string;
  authors?: number[];
  subjects?: number[];
  editions?: number[];
  activeEdition?: number;
  originalPublicationDate?: Date;
}

export interface Edition {
  isbn10: string;
  isbn13: string;
  editionTitle: string;
  editionDescription: string;
  pageCount: number;
  publicationDate: Date;
  cover: string;
}

export interface Subject {
  name: string;
  description: string;
  slug: string;
}

