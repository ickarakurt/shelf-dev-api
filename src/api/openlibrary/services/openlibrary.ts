import path from "path";
import fs from "fs";
import axios from "axios";
import https from "https";
import sizeOf from "buffer-image-size";

const ADMIN_ID = 1;

// At request level
const agent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * utils
 */
function slugify(str) {
  str = str.replace(/^\s+|\s+$/g, ''); // trim
  str = str.toLowerCase();
  
  // remove accents, swap ñ for n, etc
  var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  var to   = "aaaaeeeeiiiioooouuuunc------";
  for (var i=0, l=from.length ; i<l ; i++) {
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
    console.log("🚀 ~ upload ~ error:", error)
    return null
  }
};

/**
 * Paths
 */

const authorPath = (olId: string) => `https://openlibrary.org/authors/${olId}.json`;
const authorCoverPath = (olId: string) => `https://covers.openlibrary.org/a/olid/${olId}.jpg`;
const bookPath = (olId: string) => `https://openlibrary.org/books/${olId}.json`;
const workPath = (olId: string) => `https://openlibrary.org/works/${olId}.json`;
const getByIsbnPath = (isbn: string) =>  `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;
const editionsPath = (olId: string) => `https://openlibrary.org/works/${olId}/editions.json`;

const getBook = async (olId: string) => {
  const response = await fetch(bookPath(olId));
  const data: any = await response.json();
  return data;
}

const getAuthor = async (olId: string) => {
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

const saveSubject = async (subject: any) => {
  await strapi.services.subjects.create({
    name: subject.name,
    slug: subject.slug,
  });
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

const saveAuthor = async (author: Author) => {
  return await strapi.entityService.create('api::author.author',{
    data: {
      name: author.name,
      biography: author.biography,
      birthDate: author.birthDate,
      slug: author.slug,
      photo: author.photo,
    },
  });
}

const saveBook = async (book: Book) => {
  await strapi.services.books.create({
    name: book.name,
    slug: book.slug,
    summary: book.summary,
  });
}

const saveEdition = async (edition: Edition) => {
  await strapi.services.editions.create({
    isbn10: edition.isbn10,
    isbn13: edition.isbn13,
    editionTitle: edition.editionTitle,
    editionDescription: edition.editionDescription,
    pageCount: edition.pageCount,
    publishedDate: edition.publishedDate,
    cover: edition.cover,
  });
}

export default () => ({
  allFetchAndSave: async (isbn: string) => {
    const data = await getByIsbn(isbn);
    const bookData = data[`ISBN:${isbn}`];

    // Fetching additional data based on bookData
    const authors = bookData.authors.map(author => author.url.split('/')[4]);
    authors.forEach(async author => {
        const authorData = await getAuthor(author);
        try {
          const coverPath = await download(authorData.photo);
          const uploadResponse = await upload(coverPath);
          await saveAuthor({ ...authorData, photo: uploadResponse.id});
          console.log('Author saved');
        } catch (error) {
          console.log("🚀 ~ allFetchAndSave: ~ error:", error)
          console.log('Author already exists');
        }
    }
    );

    return authors;
  }
});

// types to use in the service

export interface Author {
  name: string;
  biography: string;
  birthDate: string;
  photo: string;
  slug: string;
  books?: Book[];
}

export interface Book {
  name: string;
  slug: string;
  summary: string;
  authors?: Author[];
  subjects?: Subject[];
  editions?: Edition[];
  activeEdition?: Edition;
}

export interface Edition {
  isbn10: string;
  isbn13: string;
  editionTitle: string;
  editionDescription: string;
  pageCount: number;
  publishedDate: Date;
  cover: string;
}

export interface Subject {
  name: string;
  description: string;
  slug: string;
}

