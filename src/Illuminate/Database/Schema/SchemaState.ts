import type { Connection } from '../Connection'

import { Filesystem } from '../../Filesystem/Filesystem'

export abstract class SchemaState {
  /**
 * The connection instance.
 *
 * @var \Illuminate\Database\Connection
 */
  protected connection: Connection

  /**
   * The filesystem instance.
   *
   * @var \Illuminate\Filesystem\Filesystem
   */
  protected files: Filesystem

  /**
   * The output callable instance.
   *
   * @var callable
   */
  protected output?: ((...args: unknown[]) => unknown)

  /**
 * The process factory callback.
 *
 * @var callable
 */
  protected processFactory: ((...args: unknown[]) => unknown)

  /**
   * Create a new dumper instance.
   *
   * @param  \Illuminate\Database\Connection  $connection
   * @param  \Illuminate\Filesystem\Filesystem|null  $files
   * @param  callable|null  $processFactory
   */
  public constructor (connection: Connection, files?: Filesystem, processFactory?: ((...args: unknown[]) => Processor)) {
    this.connection = connection

    this.files = files ?? new Filesystem()

    this.processFactory = processFactory ?? ((...args: unknown[]) => {
      return Process.fromShellCommandline(...args).setTimeout(null)
    })

    this.handleOutputUsing(() => {
      //
    })
  }

  /**
 * Specify the callback that should be used to handle process output.
 *
 * @param  callable  $output
 * @return $this
 */
  public handleOutputUsing (output: ((...args: unknown[]) => unknown)) {
    this.output = output

    return this
  }
}
