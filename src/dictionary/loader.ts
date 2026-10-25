import type { FormToLemmaMap, LemmaToGlossMap } from './types';
import formToLemmaData from '../../data/form-to-lemma.json';
import lemmaToGlossData from '../../data/lemma-to-gloss.json';

class DictionaryLoader {
  private formMap: FormToLemmaMap | null = null;
  private glossMap: LemmaToGlossMap | null = null;
  private loaded = false;

  public async load(): Promise<void> {
    if (this.loaded) return;
    this.formMap = formToLemmaData as FormToLemmaMap;
    this.glossMap = lemmaToGlossData as LemmaToGlossMap;
    this.loaded = true;
  }

  public getFormMap(): FormToLemmaMap {
    return this.formMap || (formToLemmaData as FormToLemmaMap);
  }

  public getGlossMap(): LemmaToGlossMap {
    return this.glossMap || (lemmaToGlossData as LemmaToGlossMap);
  }
}

export const dictionaryLoader = new DictionaryLoader();
