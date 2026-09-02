import type {
  AcoFolder,
  AcoFolderCreateParams,
  ApiError,
  IBaseApplication,
  IFolderRunnerFactory,
} from "~/types.js";
import type { FolderApplication } from "~/apps/FolderApplication.js";

export type AcoFolderType = "cms" | "PbPage" | "FmFile";

interface AcoFolderData {
  title: string;
  slug: string;
  type: AcoFolderType;
  parentId?: string | undefined;
}

const folderList: Pick<AcoFolderData, "title" | "slug" | "parentId">[] = [
  // Space Exploration
  {
    title: "Space Exploration",
    slug: "space-exploration",
  },
  {
    title: "Energy Production",
    slug: "energy-production",
    parentId: "space-exploration",
  },
  {
    title: "Space Walks",
    slug: "space-walks",
    parentId: "space-exploration",
  },
  {
    title: "Space Stations",
    slug: "space-stations",
    parentId: "space-exploration",
  },
  // Food Production
  {
    title: "Food Production",
    slug: "food-production",
  },
  {
    title: "Bio",
    slug: "bio",
    parentId: "food-production",
  },
  {
    title: "Chemical",
    slug: "chemical",
    parentId: "food-production",
  },
  {
    title: "Mechanical",
    slug: "mechanical",
    parentId: "food-production",
  },
  // Health Management
  {
    title: "Health Management",
    slug: "health-management",
  },
  {
    title: "Preventative",
    slug: "preventative",
    parentId: "health-management",
  },
  {
    title: "Curative",
    slug: "curative",
    parentId: "health-management",
  },
  // Habitat
  {
    title: "Habitat",
    slug: "habitat",
  },
  {
    title: "Structural",
    slug: "structural",
    parentId: "habitat",
  },
  {
    title: "Environmental",
    slug: "environmental",
    parentId: "habitat",
  },
  {
    title: "Life Support",
    slug: "life-support",
    parentId: "habitat",
  },
  {
    title: "Waste Management",
    slug: "waste-management",
    parentId: "habitat",
  },
  // Transportation
  {
    title: "Transportation",
    slug: "transportation",
  },
  {
    title: "Surface",
    slug: "surface",
    parentId: "transportation",
  },
  {
    title: "Air",
    slug: "air",
    parentId: "transportation",
  },
  {
    title: "Water",
    slug: "water",
    parentId: "transportation",
  },
  {
    title: "Space",
    slug: "space",
    parentId: "transportation",
  },
  // Communication
  {
    title: "Communication",
    slug: "communication",
  },
  {
    title: "Data",
    slug: "data",
    parentId: "communication",
  },
  {
    title: "Voice",
    slug: "voice",
    parentId: "communication",
  },
  {
    title: "Video",
    slug: "video",
    parentId: "communication",
  },
];

const getParentId = (
  folder: Pick<AcoFolderData, "parentId" | "type">,
  parents?: AcoFolder[],
): string | null => {
  if (!parents || parents.length === 0) {
    return null;
  }
  if (!folder.parentId) {
    return null;
  }
  const parent = parents.find((p) => p.slug === folder.parentId && p.type === folder.type);
  return parent?.id || null;
};

const createFolderDataList = (app: AcoFolderType, entries?: AcoFolder[]) => {
  const folders: AcoFolderCreateParams[] = [];

  for (const folder of folderList) {
    if (!folder.parentId && !entries) {
      folders.push({
        title: folder.title,
        slug: folder.slug,
        parentId: null,
        type: app,
      });
      continue;
    } else if (!entries) {
      continue;
    }
    const parentId = getParentId(
      {
        parentId: folder.parentId,
        type: app,
      },
      entries,
    );
    if (!parentId) {
      continue;
    }
    folders.push({
      title: folder.title,
      slug: folder.slug,
      parentId,
      type: app,
    });
  }

  return folders;
};

interface CreateFoldersCallableParams {
  app: FolderApplication;
  folders: AcoFolder[];
  errors: ApiError[];
  type: AcoFolderType;
}

interface CreateFoldersCallable {
  (params: CreateFoldersCallableParams): Promise<void>;
}

const createFolders: CreateFoldersCallable = async (params) => {
  const { app, folders, errors, type } = params;
  const parentFolderDataList = createFolderDataList(type);
  const parentFoldersResult = await app.createViaGraphQL(parentFolderDataList);
  folders.push(...parentFoldersResult.folders);
  errors.push(...parentFoldersResult.errors);

  const childFolderDataList = createFolderDataList(type, folders);
  if (childFolderDataList.length === 0) {
    return;
  }
  const childFoldersResult = await app.createViaGraphQL(childFolderDataList);
  folders.push(...childFoldersResult.folders);
  errors.push(...childFoldersResult.errors);
};

// eslint-disable-next-line
const createCmsFolders = async (
  app: FolderApplication,
  folders: AcoFolder[],
  errors: ApiError[],
): Promise<void> => {
  return createFolders({
    app,
    folders,
    errors,
    type: "cms",
  });
};

const createPageFolders = async (
  app: FolderApplication,
  folders: AcoFolder[],
  errors: ApiError[],
): Promise<void> => {
  return createFolders({
    app,
    folders,
    errors,
    type: "PbPage",
  });
};

// eslint-disable-next-line
const createFileFolders = async (
  app: FolderApplication,
  folders: AcoFolder[],
  errors: ApiError[],
): Promise<void> => {
  return createFolders({
    app,
    folders,
    errors,
    type: "FmFile",
  });
};

const executeFolderRunner = async (app: IBaseApplication) => {
  const folderApp = app.getApp<FolderApplication>("folder");

  const folders: AcoFolder[] = [];
  const errors: ApiError[] = [];

  // await createCmsFolders(folderApp, folders, errors);
  await createPageFolders(folderApp, folders, errors);
  // await createFileManagerFolders(folderApp, folders, errors);

  return {
    folders,
    total: folders.length,
    errors,
  };
};

export const folderRunnerFactory: IFolderRunnerFactory = (app) => {
  return {
    id: "folders",
    name: "Folders",
    exec: async () => {
      return executeFolderRunner(app);
    },
  };
};
