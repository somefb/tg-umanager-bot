export default class ErrorCancelled extends Error {
  isCancelled = true;
  isTimeout = false;
}
