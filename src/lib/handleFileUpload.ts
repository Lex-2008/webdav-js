import DAV from './DAV';
import Entry from './Entry';
import State from './State';
import joinPath from './joinPath';
import { success } from 'melba-toast';
import { t } from 'i18next';

const XHRPutFile = (
  url: string,
  file: File,
  onProgress: (progress: number) => void
): Promise<ProgressEvent> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = resolve;
    xhr.onerror = reject;
    xhr.onabort = reject;
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
};

export const handleFileUpload = async (
  dav: DAV,
  state: State,
  file: File
): Promise<void> => {
  const collection = await dav.list(state.getPath(), true);

  if (!collection) {
    return;
  }

  state.setCollection(collection);

  const [existingFile] = collection.filter(
    (entry: Entry): boolean => entry.name === file.name
  );

  if (existingFile) {
    // TODO: nicer notification
    if (
      !confirm(
        t('overwriteFileConfirmation', {
          file: existingFile.title,
        })
      )
    ) {
      return;
    }

    collection.remove(existingFile);
  }

  const placeholder = new Entry({
    fullPath: joinPath(state.getPath(), file.name),
    modified: Date.now(),
    size: file.size,
    mimeType: file.type,
    placeholder: true,
    collection,
  });

  collection.add(placeholder);

  const result = await XHRPutFile(
    joinPath(location.pathname, file.name),
    file,
    (uploaded: number) => {
      console.log(`${Math.round((uploaded / file.size) * 100)}% uploaded...`);
    }
  );

  // TODO: better error handling - try...catch, likely?
  if (!result) {
    collection.remove(placeholder);

    state.update();

    return;
  }

  placeholder.placeholder = false;

  state.update();

  success(
    t('successfullyUploaded', {
      interpolation: {
        escapeValue: false,
      },
      file: file.name,
    })
  );
};

export default handleFileUpload;