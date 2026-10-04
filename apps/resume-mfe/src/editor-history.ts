export interface EditorHistory<T> {
  readonly current: T;
  readonly saved: T;
  readonly past: readonly T[];
  readonly future: readonly T[];
}
export type HistoryAction<T> =
  { type: "edit"; value: T } | { type: "undo" | "redo" | "save" | "cancel" };
const equal = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);
export const isDirty = <T>(state: EditorHistory<T>) =>
  !equal(state.current, state.saved);
export const createHistory = <T>(value: T): EditorHistory<T> => ({
  current: value,
  saved: value,
  past: [],
  future: [],
});

export function editorHistory<T>(
  state: EditorHistory<T>,
  action: HistoryAction<T>,
): EditorHistory<T> {
  switch (action.type) {
    case "edit":
      if (equal(state.current, action.value)) return state;
      return {
        ...state,
        current: action.value,
        past: [...state.past, state.current].slice(-100),
        future: [],
      };
    case "undo": {
      const previous = state.past.at(-1);
      return previous === undefined
        ? state
        : {
            ...state,
            current: previous,
            past: state.past.slice(0, -1),
            future: [state.current, ...state.future],
          };
    }
    case "redo": {
      const next = state.future[0];
      return next === undefined
        ? state
        : {
            ...state,
            current: next,
            past: [...state.past, state.current].slice(-100),
            future: state.future.slice(1),
          };
    }
    case "save":
      return { ...state, saved: state.current };
    case "cancel":
      return isDirty(state)
        ? {
            ...state,
            current: state.saved,
            past: [...state.past, state.current].slice(-100),
            future: [],
          }
        : state;
  }
}
