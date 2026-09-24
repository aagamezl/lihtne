import type { Expression } from '../Query/Expression'

import { Arr } from '../../Collections/Arr'

export class BuildsWhereDateClauses {
  /**
   * Add a where clause to determine if a "date" column is in the past to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public wherePast (columns: Array<string | Expression>) {
    return this.wherePastOrFuture(columns, '<', 'and')
  }

  /**
   * Add an "or where" clause to determine if a "date" column is in the future to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public orWhereFuture (columns: Array<string | Expression>) {
    return this.wherePastOrFuture(columns, '>', 'or')
  }

  /**
 * Add an "or where" clause to determine if a "date" column is in the future or now to the query.
 *
 * @param  array|string  $columns
 * @return $this
 */
  public orWhereNowOrFuture (columns: Array<string | Expression>) {
    return this.wherePastOrFuture(columns, '>=', 'or')
  }

  /**
   * Add an "where" clause to determine if a "date" column is in the past or future.
   *
   * @param  array|string  $columns
   * @param  string  $operator
   * @param  string  $boolean
   * @return $this
   */
  protected wherePastOrFuture (columns: Array<string | Expression>, operator: string, boolean: string) {
    const type = 'Basic'
    const value = new Date()

    for (const column of Arr.wrap(columns)) {
      this.wheres.push({ type, column, boolean, operator, value })
      this.addBinding(value)
    }

    return this
  }

  /**
   * Add a where clause to determine if a "date" column is in the past or now to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public whereNowOrPast (columns: Array<string | Expression>) {
    return this.wherePastOrFuture(columns, '<=', 'and')
  }

  /**
   * Add an "or where" clause to determine if a "date" column is in the past to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public orWherePast (columns: Array<string | Expression>) {
    return this.wherePastOrFuture(columns, '<', 'or')
  }

  /**
   * Add a where clause to determine if a "date" column is in the past or now to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public orWhereNowOrPast (columns: Array<string | Expression>) {
    return this.wherePastOrFuture(columns, '<=', 'or')
  }

  /**
   * Add a where clause to determine if a "date" column is in the future to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public whereFuture (columns: Array<string | Expression>) {
    return this.wherePastOrFuture(columns, '>', 'and')
  }

  /**
   * Add a where clause to determine if a "date" column is in the future or now to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public whereNowOrFuture (columns: Array<string | Expression>) {
    return this.wherePastOrFuture(columns, '>=', 'and')
  }

  /**
   * Add a "where date" clause to determine if a "date" column is today to the query.
   *
   * @param  array|string  $columns
   * @param  string  $boolean
   * @return $this
   */
  public whereToday (columns: Array<string | Expression>, boolean: string = 'and') {
    return this.whereTodayBeforeOrAfter(columns, '=', boolean)
  }

  /**
   * Add a "where date" clause to determine if a "date" column is before today.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public whereBeforeToday (columns: Array<string | Expression>) {
    return this.whereTodayBeforeOrAfter(columns, '<', 'and')
  }

  /**
   * Add a "where date" clause to determine if a "date" column is today or before to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public whereTodayOrBefore (columns: Array<string | Expression>) {
    return this.whereTodayBeforeOrAfter(columns, '<=', 'and')
  }

  /**
   * Add a "where date" clause to determine if a "date" column is after today.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public whereAfterToday (columns: Array<string | Expression>) {
    return this.whereTodayBeforeOrAfter(columns, '>', 'and')
  }

  /**
   * Add a "where date" clause to determine if a "date" column is today or after to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public whereTodayOrAfter (columns: Array<string | Expression>) {
    return this.whereTodayBeforeOrAfter(columns, '>=', 'and')
  }

  /**
   * Add an "or where date" clause to determine if a "date" column is today to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public orWhereToday (columns: Array<string | Expression>) {
    return this.whereToday(columns, 'or')
  }

  /**
   * Add an "or where date" clause to determine if a "date" column is before today.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public orWhereBeforeToday (columns: Array<string | Expression>) {
    return this.whereTodayBeforeOrAfter(columns, '<', 'or')
  }

  /**
   * Add an "or where date" clause to determine if a "date" column is today or before to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public orWhereTodayOrBefore (columns: Array<string | Expression>) {
    return this.whereTodayBeforeOrAfter(columns, '<=', 'or')
  }

  /**
   * Add an "or where date" clause to determine if a "date" column is after today.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public orWhereAfterToday (columns: Array<string | Expression>) {
    return this.whereTodayBeforeOrAfter(columns, '>', 'or')
  }

  /**
   * Add an "or where date" clause to determine if a "date" column is today or after to the query.
   *
   * @param  array|string  $columns
   * @return $this
   */
  public orWhereTodayOrAfter (columns: Array<string | Expression>) {
    return this.whereTodayBeforeOrAfter(columns, '>=', 'or')
  }

  /**
   * Add a "where date" clause to determine if a "date" column is today or after to the query.
   *
   * @param  array|string  $columns
   * @param  string  $operator
   * @param  string  $boolean
   * @return $this
   */
  protected whereTodayBeforeOrAfter (columns: Array<string | Expression>, operator: string, boolean: string) {
    const value = new Date().toISOString().split('T')[0]

    for (const column of Arr.wrap(columns)) {
      this.addDateBasedWhere('Date', column, operator, value, boolean)
    }

    return this
  }
}
