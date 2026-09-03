import { makeAutoObservable } from "mobx";
import { Router as Abstraction } from "./abstractions/Router.js";

interface HistoryEntry {
  view: string;
  params: Record<string, string>;
}

class RouterImpl implements Abstraction.Interface {
  private _currentView = "project-list";
  private _params: Record<string, string> = {};
  private _history: HistoryEntry[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get currentView(): string {
    return this._currentView;
  }

  public get params(): Record<string, string> {
    return this._params;
  }

  public navigate = (view: string, params?: Record<string, string>): void => {
    this._history.push({ view: this._currentView, params: { ...this._params } });
    this._currentView = view;
    this._params = params ?? {};
  };

  public goBack = (): void => {
    const prev = this._history.pop();
    if (prev) {
      this._currentView = prev.view;
      this._params = prev.params;
    } else {
      this._currentView = "project-list";
      this._params = {};
    }
  };
}

export const Router = Abstraction.createImplementation({
  implementation: RouterImpl,
  dependencies: [],
});
