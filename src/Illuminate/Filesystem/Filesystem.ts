import crypto from 'node:crypto'
import fs from 'node:fs/promises'

import { Conditionable } from '../Conditionable/Traits/Conditionable'
import { Macroable } from '../Macroable/Traits/Macroable'
import { mixing } from '../Support/Traits/use'

export class Filesystem extends mixing(Macroable).useTrait([Conditionable, Macroable]) {
  /**
   * Determine if a file or directory exists.
   *
   * @param  string  $path
   * @return bool
   */
  public async exists (path: string): Promise<boolean> {
    return fs.stat(path).then(() => true).catch(() => false)
  }

  /**
   * Get the returned value of a file.
   *
   * @param  string  $path
   * @param  array  $data
   * @return mixed
   *
   * @throws \Illuminate\Contracts\Filesystem\FileNotFoundException
   */
  public async getRequire (path: string, data: Record<string, unknown> = {}): Promise<unknown> {
    if (await this.isFile(path)) {
      return (async () => {
        const imported: { default?: unknown } = await import(path)
        const exported = imported.default

        return typeof exported === 'function' ? exported(data) : exported
      })()
    }

    throw new Error(`FileNotFoundException: File does not exist at path ${path}.`)
  }

  // /**
  //  * Get the contents of a file.
  //  *
  //  * @param  string  $path
  //  * @param  bool  $lock
  //  * @return string
  //  *
  //  * @throws \Illuminate\Contracts\Filesystem\FileNotFoundException
  //  */
  // public async get(path: string, lock = false): Promise<string> {
  //   if (await this.isFile(path)) {
  //     return lock ? await this.sharedGet(path) : await fs.readFile(path, 'utf-8');
  //   }

  //   throw new Error(`FileNotFoundException: File does not exist at path ${path}.`);
  // }

  /**
   * Get the hash of the file at the given path.
   *
   * @param  string  $path
   * @param  string  $algorithm
   * @return string|false
   */
  public async hash (path: string, algorithm: string = 'md5'): Promise<string | false> {
    return crypto.createHash(algorithm).update(await fs.readFile(path)).digest('hex')
  }

  /**
 * Determine if the given path is a file.
 *
 * @param  string  $file
 * @return bool
 */
  public async isFile (file: string): Promise<boolean> {
    return fs.stat(file).then(() => true).catch(() => false)
  }

  /**
   * Get the contents of a file as decoded JSON.
   *
   * @param  string  $path
   * @param  int  $flags
   * @param  bool  $lock
   * @return array
   *
   * @throws \Illuminate\Contracts\Filesystem\FileNotFoundException
   */
  public async json (path: string, lock = false): Promise<unknown> {
    return JSON.parse(await this.get(path, lock))
  }

  /**
   * Determine if a file or directory is missing.
   *
   * @param  string  $path
   * @return bool
   */
  public async missing (path: string): Promise<boolean> {
    return !(await this.exists(path))
  }

  /**
   * Write the contents of a file.
   *
   * @param  string  $path
   * @param  string  $contents
   * @param  bool  $lock
   * @return int|bool
   */
  public async put (path: string, contents: string, lock = false): Promise<number | boolean> {
    try {
      await fs.writeFile(path, contents, { flag: lock ? 'wx' : 'w' })

      return Buffer.byteLength(contents)
    } catch {
      return false
    }
  }
}
