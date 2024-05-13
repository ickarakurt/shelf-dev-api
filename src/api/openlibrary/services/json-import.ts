/**
 * JSON Import Service
 *
 */
import axios from "axios";
import sizeOf from "buffer-image-size";
import fs from "fs";
import https from "https";
import path from "path";

const ADMIN_ID = 1;
const agent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * utils
 */
function slugify(str: string): string {
  str = str.replace(/^\s+|\s+$/g, ""); // trim
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  let from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  let to = "aaaaeeeeiiiioooouuuunc------";
  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), "g"), to.charAt(i));
  }

  str = str
    .replace(/[^a-z0-9 -]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // collapse whitespace and replace by -
    .replace(/-+/g, "-"); // collapse dashes

  return str;
}

/**
 *
 * Types
 *
 **/

export interface Root {
  book: Book;
}

export interface Book {
  pages: number;
  title: string;
  description: string;
  subtitle: string;
  release_date: string;
  default_ebook_edition_id: any;
  default_audio_edition_id: any;
  default_cover_edition_id: number;
  default_physical_edition_id: number;
  release_year: number;
  slug: string;
  contributions: Contribution[];
  editions: Edition[];
}

export interface Contribution {
  id: number;
  contribution: any;
  author: Author;
}

export interface Author {
  id: number;
  name: string;
  bio: string;
  cached_image: {
    url: string;
  };
  links: Link[];
  identifiers: string;
  slug: string;
  born_year: number;
}

export interface Link {
  url: string;
  type: Type;
  title: string;
}

export interface Type {
  key: string;
}

export interface Edition {
  id: number;
  asin: string;
  isbn_13: string;
  isbn_10?: string;
  image_id?: number;
  book_id: number;
  language: Language;
  audio_seconds: any;
  cached_image?: {
    url?: string;
  };
  description?: string;
  edition_format: string;
  dto_external: string;
  edition_information?: string;
  pages: number;
  release_date: string;
  release_year: any;
  title: string;
  images: Image[];
}

export interface Language {
  id: number;
  language: string;
}

export interface Image {
  height: number;
  id: number;
  imageable_id: number;
  imageable_type: string;
  url: string;
}

/**
 * JSON Import Service
 * DB Service methods
 *
 **/

const saveAuthor = (author: Partial<Author>) => {
  return strapi.entityService.create("api::author.author", {
    data: {
      name: author.name,
      biography: author.bio,
      birthDate: author.born_year ? author.born_year : undefined,
      slug: author.slug,
      photo: author.cached_image.url,
      identifiers: author.identifiers,
      links: author.links as unknown as string,
      publishedAt: new Date(),
    },
  });
};

const saveBook = async (book) => {
  try {
    const createdBook = await strapi.entityService.create("api::book.book", {
      data: {
        name: book.name,
        subtitle: book.subtitle,
        slug: book.slug,
        summary: book.summary,
        authors: book.authors,
        originalPublicationDate: book.originalPublicationDate
          ? new Date(book.originalPublicationDate)
          : undefined,
        publishedAt: new Date(),
      },
    });
    return createdBook;
  } catch (error) {
    const savedBook = await strapi.entityService.findMany("api::book.book", {
      filters: {
        slug: book.slug,
      },
    });
    return savedBook[0];
  }
};

const saveEdition = async (edition) => {
  try {
    const savedEdition = await strapi.entityService.create(
      "api::edition.edition",
      {
        data: {
          asin: edition.asin,
          isbn10: edition.isbn10,
          isbn13: edition.isbn13,
          editionTitle: edition.editionTitle,
          editionDescription: edition.editionDescription,
          pageCount: edition.pageCount,
          publicationDate: edition.publicationDate
            ? new Date(String(edition.publicationDate))
            : undefined,
          cover: edition.cover,
          format: edition.editionFormat,
          external: edition.external,
          editionInformation: edition.editionInformation,
          audioLength: edition.audioLength,
          languageId: edition.languageId,
          publishedAt: new Date(),
        },
      },
    );
    return savedEdition;
  } catch (error) {
    const savedEdition = await strapi.entityService.findMany(
      "api::edition.edition",
      {
        filters: {
          $or: [{ isbn10: edition.isbn10 }, { isbn13: edition.isbn13 }],
        },
      },
    );
    return savedEdition[0];
  }
};

const setActiveEditions = async (bookId, editionIds, activeEdition) => {
  try {
    const updatedBook = await strapi.entityService.update(
      "api::book.book",
      bookId,
      {
        data: {
          editions: editionIds,
          activeEdition: activeEdition,
        },
      },
    );
    return updatedBook;
  } catch (error) {
    console.log("🚀 ~ setActiveEditions ~ error:", error);
    return null;
  }
};

async function processEdition(editionData: Edition) {
  let uploadResponse;
  try {
    const editionCover =
      editionData.images.length > 0
        ? editionData.images[0].url
        : editionData.cached_image?.url;
    if (editionCover) {
      const coverPath = await download(editionCover);
      uploadResponse = await upload(coverPath);
    }

    const editionToSave = {
      asin: editionData.asin,
      isbn10: editionData.isbn_10?.length > 0 ? editionData.isbn_10 : undefined,
      isbn13: editionData.isbn_13?.length > 0 ? editionData.isbn_13 : undefined,
      editionTitle: editionData.title,
      editionDescription: editionData.description,
      pageCount: editionData.pages,
      languageId: editionData.language?.id,
      publicationDate: editionData.release_date,
      external: editionData.dto_external,
      editionInformation: editionData.edition_information,
      audioLength: editionData.audio_seconds,
      editionFormat: editionData.edition_format,
      cover: editionCover ? uploadResponse.id : undefined,
    };

    const savedEdition = await saveEdition(editionToSave);
    return savedEdition;
  } catch (error) {
    console.log("🚀 ~ processEdition ~ error:", error);
    const savedEdition = await strapi.entityService.findMany(
      "api::edition.edition",
      {
        filters: {
          $or: [
            { isbn10: editionData.isbn_10 },
            { isbn13: editionData.isbn_13 },
          ],
        },
      },
    );
    return savedEdition[0];
  }
}

/**
 * JSON Import Service
 * Image service methods
 *
 */

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
    folderPath: "/",
    getStream: () => fs.createReadStream(imgPath), // create a readable stream
  };
  try {
    await uploadProvider.upload(entity);
    const result = await strapi
      .query("plugin::upload.file")
      .create({ data: entity });
    return result;
  } catch (error) {
    return null;
  }
};

/**
 * Process the JSON data
 */

export const processRoot = async (root: Root) => {
  const book = root.book;

  // Process authors
  const authors = book.contributions.map((contribution) => contribution.author);
  const savedAuthors = [];
  await Promise.all(
    authors.map(async (author) => {
      try {
        let uploadedImageId;
        const isImageExists = Boolean(author.cached_image?.url);
        if (isImageExists) {
          const imageURLParts = author.cached_image.url.split("/");
          const newLink = `https://cdn.hardcover.app/enlarge?url=https://storage.googleapis.com/hardcover/authors/${imageURLParts[4]}/${imageURLParts[5]}&width=400&height=400&type=webp`;
          const coverPath = await download(newLink);
          const uploadResponse = await upload(coverPath);
          uploadedImageId = uploadResponse.id;
        }

        const savedAuthor = await saveAuthor({
          name: author.name,
          bio: author.bio,
          born_year: author.born_year,
          identifiers: author.identifiers,
          slug: author.slug,
          links: author.links,
          cached_image: {
            url: isImageExists ? uploadedImageId : undefined,
          },
        });
        savedAuthors.push(savedAuthor);
      } catch (error) {
        console.log("🚀 ~ savedAuthors ~ error:", error);
        const result = await strapi.entityService.findMany(
          "api::author.author",
          {
            filters: { slug: author.slug },
          },
        );
        console.log("🚀 ~ authors.forEach ~ result:", result);
        savedAuthors.push(result[0]);
      }
    }),
  );

  // Process book
  const bookToSave = {
    name: book.title,
    slug: book.slug,
    subtitle: book.subtitle,
    summary: book.description,
    authors: savedAuthors.map((author) => author.id),
    originalPublicationDate: book.release_date,
  };
  console.log("🚀 ~ processRoot ~ bookToSave:", bookToSave);
  const savedBook = await saveBook(bookToSave);

  // Process editions sequentially to handle default edition correctly
  const savedEditions = [];
  let activeEditionId;
  for (const edition of book.editions) {
    const savedEdition = await processEdition(edition);
    savedEditions.push(savedEdition);
    if (edition.id === book.default_cover_edition_id) {
      activeEditionId = savedEdition.id; // assumes processEdition returns an object with an id
    }
  }
  await setActiveEditions(
    savedBook.id,
    savedEditions.map((edition) => edition.id),
    activeEditionId,
  );

  // Returning processed data
  return {
    book: savedBook,
    authors: savedAuthors,
    editions: savedEditions,
  };
};

// setup
/**
 * Add subjects
 * Add author URLs
 *
 *
 *
 *
 */
