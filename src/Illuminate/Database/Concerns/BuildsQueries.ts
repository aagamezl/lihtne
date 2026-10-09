import { cloneDeep } from 'es-toolkit'

import type { Collection, Collection as SupportCollection } from '../../Collections/Collection'
import type { Builder as EloquentBuilder } from '../Eloquent/Builder'

import { dataGet, last as lastItem } from '../../Collections/helpers'
import { Conditionable } from '../../Conditionable/Traits/Conditionable'
import {
  Cursor,
  CursorPaginator,
  LengthAwarePaginator,
  Paginator
} from '../../Pagination'
import { Str } from '../../Support/Str'
import { Builder } from '../Query'
import { SortDirection } from '../Query/Enums/SortDirection'
import { Expression } from '../Query/Expression'

export class BuildsQueries extends Conditionable {
  /**
   * Chunk the results of the query.
   *
   * @param  int  $count
   * @param  callable(\Illuminate\Support\Collection, int): mixed  $callback
   * @return bool
   */
  public async chunk (
    count: number,
    callback: (results: Collection<PropertyKey, unknown>, page: number) => unknown
  ): Promise<boolean> {
    const clone = cloneDeep<Builder>(this)

    clone.enforceOrderBy()

    const skip = clone.getOffset()
    let remaining = clone.getLimit()

    let page = 1
    let countResults: number | undefined

    do {
      const offset = (page - 1) * count + (skip ?? 0)

      const limit = remaining === undefined ? count : Math.min(count, remaining)

      if (limit === 0) {
        break
      }

      const results = await clone.offset(offset).limit(limit).get()

      countResults = results.count()

      if (countResults === 0) {
        break
      }

      if (remaining !== undefined) {
        remaining = Math.max(remaining - countResults, 0)
      }

      if ((await callback(results, page)) === false) {
        return false
      }

      page++
    } while (countResults === count)

    return true
  }

  /**
   * Chunk the results of a query by comparing IDs.
   *
   * @param  int  $count
   * @param  callable(\Illuminate\Support\Collection, int): mixed  $callback
   * @param  string|null  $column
   * @param  string|null  $alias
   * @return bool
   */
  public chunkById (
    count: number,
    callback: (results: Collection<PropertyKey, unknown>, page: number) => unknown,
    column: string | null = null,
    alias: string | null = null
  ): Promise<boolean> {
    return this.orderedChunkById(count, callback, column ?? undefined, alias ?? undefined)
  }

  /**
   * Chunk the results of a query by comparing IDs in descending order.
   */
  public chunkByIdDesc (
    count: number,
    callback: (results: Collection<PropertyKey, unknown>, page: number) => unknown,
    column: string | null = null,
    alias: string | null = null
  ): Promise<boolean> {
    return this.orderedChunkById(
      count,
      callback,
      column ?? undefined,
      alias ?? undefined,
      SortDirection.Descending
    )
  }

  /**
   * Chunk the results of a query by comparing IDs in a given order.
   *
   * @param  int  $count
   * @param  callable(\Illuminate\Support\Collection, int): mixed  $callback
   * @param  string|null  $column
   * @param  string|null  $alias
   * @param  SortDirection|bool  $descending
   * @return bool
   */
  public async orderedChunkById (
    count: number,
    callback: (results: Collection<PropertyKey, unknown>, page: number) => unknown,
    column: string | undefined = undefined,
    alias: string | undefined = undefined,
    descending: SortDirection | boolean = false
  ): Promise<boolean> {
    column ??= this.defaultKeyName()
    alias ??= column
    let lastId: number | undefined
    const skip = this.getOffset()
    let remaining = this.getLimit()

    let page = 1
    let countResults: number | undefined

    do {
      const clone = cloneDeep<Builder>(this)

      if (skip && page > 1) {
        clone.offset(0)
      }

      const limit = remaining === undefined ? count : Math.min(count, remaining)

      if (limit === 0) {
        break
      }

      // const results =
      //   descending === SortDirection.Descending || descending === true
      //     ? await clone.forPageBeforeId(limit, lastId, column).get()
      //     : await clone.forPageAfterId(limit, lastId, column).get()
      let results: Collection<PropertyKey, unknown>
      if (descending === SortDirection.Ascending || descending === false) {
        results = await clone.forPageAfterId(limit, lastId, column).get()
      } else if (descending === SortDirection.Descending || descending === true) {
        results = await clone.forPageBeforeId(limit, lastId, column).get()
      }

      countResults = results.count()

      if (countResults === 0) {
        break
      }

      if (remaining !== undefined) {
        remaining = Math.max(remaining - countResults, 0)
      }

      if ((await callback(results, page)) === false) {
        return false
      }

      const items = results.all()
      const list = Array.isArray(items) ? items : Object.values(items)
      lastId = dataGet(lastItem(list), alias) as number | null

      if (lastId === undefined) {
        throw new Error(
          `RuntimeException: The chunkById operation was aborted because the [${alias}] column is not present in the query result.`
        )
      }

      page++
    } while (countResults === count)

    return true
  }

  /**
   * Pass the query to a given callback and then return it.
   *
   * @param  callable($this): mixed  $callback
   * @return $this
   */
  public tap (callback: (query: this) => void): this {
    callback(this)

    return this
  }

  /**
   * Pass the query to a given callback and return the result.
   *
   * @template TReturn
   *
   * @param  (callable($this): TReturn)  $callback
   * @return (TReturn is null|void ? $this : TReturn)
   */
  public pipe (callback: <TReturn>(query: this) => TReturn): this {
    return callback(this) ?? this
  }

  /**
   * Execute the query and get the first result.
   *
   * @param  array|string  $columns
   * @return TValue|undefined
   */
  public async first (
    columns: Array<string> = ['*']
  ): Promise<unknown | undefined> {
    const results = await this.limit(1).get(columns)

    return results.first()
  }

  /**
   * Execute the query and get the first result or throw an exception.
   *
   * @param  array|string  $columns
   * @param  string|null  $message
   * @return TValue
   *
   * @throws \Illuminate\Database\RecordNotFoundException
   */
  public async firstOrFail (
    $columns = ['*'],
    message: string | undefined = undefined
  ): Promise<unknown> {
    const result = await this.first($columns)

    if (result !== undefined) {
      return result
    }

    const errorMessage = message
      ? `RecordNotFoundException: ${message}`
      : 'RecordNotFoundException: No record found for the given query.'

    throw new Error(errorMessage)
  }

  // /**
  //  * Paginate the given query.
  //  */
  // public async paginate (
  //   perPage: number = 15,
  //   columns: string[] = ['*'],
  //   pageName: string = 'page',
  //   page: number | null = null,
  //   total: number | (() => number) | null = null
  // ): Promise<LengthAwarePaginator> {
  //   const currentPage = page ?? Paginator.resolveCurrentPage(pageName)

  //   const resolvedTotal =
  //     total !== null && total !== undefined
  //       ? typeof total === 'function'
  //         ? total()
  //         : total
  //       : await this.getCountForPagination()

  //   const results = resolvedTotal
  //     ? await this.forPage(currentPage, perPage).get(columns)
  //     : new SupportCollection([])

  //   return this.paginator(
  //     results,
  //     resolvedTotal,
  //     perPage,
  //     currentPage,
  //     {
  //       path: Paginator.resolveCurrentPath(),
  //       pageName
  //     }
  //   )
  // }

  protected paginator (
    items: SupportCollection<PropertyKey, unknown>,
    total: number,
    perPage: number,
    currentPage: number,
    options: { path?: string; pageName?: string }
  ): LengthAwarePaginator {
    return new LengthAwarePaginator(items, total, perPage, currentPage, options)
  }

  protected async paginateUsingCursor (
    perPage: number,
    columns: string[] = ['*'],
    cursorName: string = 'cursor',
    cursor: Cursor | string | undefined = undefined
  ): Promise<CursorPaginator> {
    if (!(cursor instanceof Cursor)) {
      cursor =
        typeof cursor === 'string'
          ? Cursor.fromEncoded(cursor)
          : CursorPaginator.resolveCurrentCursor(cursorName, cursor)
    }

    const orders = this.ensureOrderForCursorPagination(
      cursor !== undefined && cursor.pointsToPreviousItems()
    )

    if (cursor !== undefined) {
      this.setBindings([], 'union')

      const columnForWhere = (originalColumn: string): string | Expression =>
        Str.contains(originalColumn, ['(', ')'])
          ? new Expression(originalColumn)
          : originalColumn

      const addCursorConditions = (
        builder: Builder,
        previousColumn: string | undefined,
        originalColumn: string | undefined,
        index: number
      ): void => {
        const unionBuilders = builder.getUnionBuilders()

        if (previousColumn !== null) {
          originalColumn ??= this.getOriginalColumnNameForCursorPagination(
            this as Builder,
            previousColumn
          )

          builder.where(
            columnForWhere(originalColumn),
            '=',
            cursor.parameter(previousColumn) as string | number
          )

          unionBuilders.each((unionBuilder) => {
            unionBuilder.where(
              this.getOriginalColumnNameForCursorPagination(
                unionBuilder,
                previousColumn
              ),
              '=',
              cursor.parameter(previousColumn) as string | number
            )

            this.addBinding(unionBuilder.getRawBindings().where, 'union')
          })
        }

        builder.where((secondBuilder: Builder) => {
          const order = orders.all()[index]

          if (!order?.column || !order.direction) {
            return
          }

          const columnKey = String(order.column)
          const originalColumnForCompare =
            this.getOriginalColumnNameForCursorPagination(
              this as Builder,
              columnKey
            )

          secondBuilder.where(
            columnForWhere(originalColumnForCompare),
            order.direction === 'asc' ? '>' : '<',
            cursor.parameter(columnKey) as string | number
          )

          if (index < orders.count() - 1) {
            secondBuilder.orWhere((thirdBuilder: Builder) => {
              addCursorConditions(
                thirdBuilder,
                columnKey,
                originalColumnForCompare,
                index + 1
              )
            })
          }

          unionBuilders.each((unionBuilder) => {
            const unionWheres = unionBuilder.getRawBindings().where
            const unionOriginalColumn =
              this.getOriginalColumnNameForCursorPagination(
                unionBuilder,
                columnKey
              )

            unionBuilder.where((nestedUnionBuilder: Builder) => {
              nestedUnionBuilder.where(
                columnForWhere(unionOriginalColumn),
                order.direction === 'asc' ? '>' : '<',
                cursor.parameter(columnKey) as string | number
              )

              if (index < orders.count() - 1) {
                nestedUnionBuilder.orWhere((fourthBuilder: Builder) => {
                  addCursorConditions(
                    fourthBuilder,
                    columnKey,
                    unionOriginalColumn,
                    index + 1
                  )
                })
              }

              this.addBinding(unionWheres, 'union')
              this.addBinding(nestedUnionBuilder.getRawBindings().where, 'union')
            })
          })
        })
      }

      addCursorConditions(this as Builder, null, null, 0)
    }

    this.limit(perPage + 1)

    return this.cursorPaginator(await this.get(columns), perPage, cursor, {
      path: Paginator.resolveCurrentPath(),
      cursorName,
      parameters: orders.pluck('column').all() as string[]
    })
  }

  protected cursorPaginator (
    items: SupportCollection<PropertyKey, unknown>,
    perPage: number,
    cursor: Cursor | null,
    options: {
      path?: string
      cursorName?: string
      parameters?: string[]
    }
  ): CursorPaginator {
    return new CursorPaginator(items, perPage, cursor, options)
  }

  /**
   * Get the original column name of the given column, without any aliasing.
   *
   * @param  \Illuminate\Database\Query\Builder|\Illuminate\Database\Eloquent\Builder<*>  $builder
   * @param  string  $parameter
   * @return string
   */
  protected getOriginalColumnNameForCursorPagination (
    builder: Builder | EloquentBuilder,
    parameter: string
  ): string {
    const columns = builder instanceof Builder ? builder.getQuery().getColumns() : builder.getColumns()

    if (columns !== undefined) {
      for (const column of columns) {
        const position = column.lastIndexOf(' as ')
        if (position !== -1) {
          const original = column.slice(0, position)

          const alias = column.slice(position + 4)

          if (parameter === alias || builder.getGrammar().wrap(parameter) === alias) {
            return original
          }
        }
      }
    }

    return parameter
  }
}
