export type UploadPanelState = {
  selectedFileName: string | null;
  status: string | null;
  error: string | null;
  isUploading: boolean;
};

export const initialUploadPanelState = (): UploadPanelState => ({
  selectedFileName: null,
  status: null,
  error: null,
  isUploading: false
});

export const selectUploadFile = (
  filename: string | null
): UploadPanelState => ({
  ...initialUploadPanelState(),
  selectedFileName: filename
});

export const startUpload = (
  state: UploadPanelState
): UploadPanelState => ({
  ...state,
  status: null,
  error: null,
  isUploading: true
});

export const completeUpload = (safeFilename: string): UploadPanelState => ({
  selectedFileName: null,
  status: `Uploaded ${safeFilename}.`,
  error: null,
  isUploading: false
});

export const failUpload = (message: string): UploadPanelState => ({
  selectedFileName: null,
  status: null,
  error: message,
  isUploading: false
});

export const resetUploadPanelState = (): UploadPanelState =>
  initialUploadPanelState();
