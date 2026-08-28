import type { Builder, Where } from "../Builder";
import type { IndexHint } from "../IndexHint";
import { Grammar } from "./Grammar";

export class MySqlGrammar extends Grammar {
  /**
   * The grammar specific operators.
   *
   * @var string[]
   */
  override protected operators = ['sounds like'];

  /**
   * Compile a select query into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  override public compileSelect(query: Builder): string {
    const sql = this.compileSelect(query);

    if (query.timeout === null) {
      return sql;
    }

    const milliseconds = query.timeout! * 1000;

    return sql.replace(
      /^select\b/i,
      `select /*+ MAX_EXECUTION_TIME(${milliseconds}) */`
    )
  }

  /**
   * Compile a "where like" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  protected whereLike(query: Builder, where: Where) {
    where.operator = where.not ? 'not ' : '';

    where.operator += where.caseSensitive ? 'like binary' : 'like';

    return this.whereBasic(query, where);
  }

  /**
   * Compile a "where null safe equals" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  query
   * @param  array  where
   * @return string
   */
  protected whereNullSafeEquals(query: Builder, where: Where) {
    return this.wrap(where.column!) + ' <=> ' + this.parameter(where.value);
  }

  /**
   * Add a "where null" clause to the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  override protected whereNull(query: Builder, where: Where): string {
    const columnValue = String(this.getValue(where.column!));

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue);

      return '(json_extract(' + field + path + ') is null OR json_type(json_extract(' + field + path + ')) = \'NULL\')';
    }

    return super.whereNull(query, where);
  }

  /**
   * Add a "where not null" clause to the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  override protected whereNotNull(query: Builder, where: Where): string {
    const columnValue = String(this.getValue(where.column!))

    if (this.isJsonSelector(columnValue)) {
      const [field, path] = this.wrapJsonFieldAndPath(columnValue);

      return '(json_extract(' + field + path + ') is not null AND json_type(json_extract(' + field + path + ')) != \'NULL\')';
    }

    return super.whereNotNull(query, where);
  }

  /**
   * Compile a "where fulltext" clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $where
   * @return string
   */
  public whereFullText(query: Builder, where: Where) {
    const columns = this.columnize(where.columns!);

    const value = this.parameter(where.value);

    const mode = (where.options['mode'] ?? []) === 'boolean'
      ? ' in boolean mode'
      : ' in natural language mode';

    const expanded = (where.options['expanded'] ?? []) && (where.options['mode'] ?? []) !== 'boolean'
      ? ' with query expansion'
      : '';

    return `match (${columns}) against (${value}${mode}${expanded})`
  }

  /**
   * Compile the index hints for the query.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  \Illuminate\Database\Query\IndexHint  $indexHint
   * @return string
   *
   * @throws \InvalidArgumentException
   */
  protected compileIndexHint(query: Builder, indexHint: IndexHint) {
    const index = indexHint.index;

    const indexes = index.split(',').map(value => value.trim());

    for (const i of indexes) {
      if (!/^[a-zA-Z0-9_$]+$/.test(i)) {
        throw new Error('InvalidArgumentException: Index name contains invalid characters.');
      }
    }

    switch (indexHint.type) {
      case 'hint':
        return `use index (${indexHint.index})`
      case 'force':
        return `force index (${indexHint.index})`
      default:
        return `ignore index (${indexHint.index})`
    };
  }

  /**
   * Compile a group limit clause.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  override protected compileGroupLimit(query: Builder) {
    return this.useLegacyGroupLimit(query)
      ? this.compileLegacyGroupLimit(query)
      : super.compileGroupLimit(query);
  }

  /**
   * Determine whether to use a legacy group limit clause for MySQL < 8.0.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return bool
   */
  public useLegacyGroupLimit(query: Builder) {
    const version = query.getConnection().getServerVersion();

    return !query.getConnection().isMaria() && version_compare(version, '8.0.11', '<');
  }

  /**
   * Compile a group limit clause for MySQL < 8.0.
   *
   * Derived from https://softonsofa.com/tweaking-eloquent-relations-how-to-get-n-related-models-per-parent/.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @return string
   */
  protected compileLegacyGroupLimit(query: Builder) {
    $limit = (int) $query -> groupLimit['value'];
    $offset = $query -> offset;

    if (isset($offset)) {
      $offset = (int) $offset;
      $limit += $offset;

      $query -> offset = null;
    }

    $column = last(explode('.', $query -> groupLimit['column']));
    $column = this.wrap($column);

    $partition = ', @laravel_row := if(@laravel_group = '.$column.', @laravel_row + 1, 1) as `laravel_row`';
    $partition.= ', @laravel_group := '.$column;

    $orders = (array) $query -> orders;

    array_unshift($orders, [
      'column' => $query -> groupLimit['column'],
      'direction' => 'asc',
    ]);

    $query -> orders = $orders;

    $components = this.compileComponents($query);

    $sql = this.concatenate($components);

    $from = '(select @laravel_row := 0, @laravel_group := 0) as `laravel_vars`, ('.$sql.') as `laravel_table`';

    $sql = 'select `laravel_table`.*'.$partition.' from '.$from.' having `laravel_row` <= '.$limit;

    if (isset($offset)) {
      $sql.= ' and `laravel_row` > '.$offset;
    }

    return $sql.' order by `laravel_row`';
  }

  /**
   * Compile an insert ignore statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  public compileInsertOrIgnore(query: Builder, array $values) {
    return Str.replaceFirst('insert', 'insert ignore', this.compileInsert($query, $values));
  }

  /**
   * Compile an insert ignore statement using a subquery into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $columns
   * @param  string  $sql
   * @return string
   */
  public compileInsertOrIgnoreUsing(query: Builder, array $columns, string $sql) {
    return Str.replaceFirst('insert', 'insert ignore', this.compileInsertUsing($query, $columns, $sql));
  }

  /**
   * Compile a "JSON contains" statement into SQL.
   *
   * @param  string  $column
   * @param  string  $value
   * @return string
   */
  protected compileJsonContains($column, $value) {
    [$field, $path] = this.wrapJsonFieldAndPath($column);

    return 'json_contains('.$field.', '.$value.$path.')';
  }

  /**
   * Compile a "JSON overlaps" statement into SQL.
   *
   * @param  string  $column
   * @param  string  $value
   * @return string
   */
  protected compileJsonOverlaps($column, $value) {
    [$field, $path] = this.wrapJsonFieldAndPath($column);

    return 'json_overlaps('.$field.', '.$value.$path.')';
  }

  /**
   * Compile a "JSON contains key" statement into SQL.
   *
   * @param  string  $column
   * @return string
   */
  protected compileJsonContainsKey($column) {
    [$field, $path] = this.wrapJsonFieldAndPath($column);

    return 'ifnull(json_contains_path('.$field.', \'one\''.$path.'), 0)';
  }

  /**
   * Compile a "JSON length" statement into SQL.
   *
   * @param  string  $column
   * @param  string  $operator
   * @param  string  $value
   * @return string
   */
  protected compileJsonLength($column, $operator, $value) {
    [$field, $path] = this.wrapJsonFieldAndPath($column);

    return 'json_length('.$field.$path.') '.$operator.' '.$value;
  }

  /**
   * Compile a "JSON value cast" statement into SQL.
   *
   * @param  string  $value
   * @return string
   */
  public compileJsonValueCast($value) {
    return 'cast('.$value.' as json)';
  }

  /**
   * Compile the random statement into SQL.
   *
   * @param  string|int  $seed
   * @return string
   *
   * @throws \InvalidArgumentException
   */
  public compileRandom($seed) {
    if ($seed === '' || $seed === null) {
      return 'RAND()';
    }

    if (!is_numeric($seed)) {
      throw new InvalidArgumentException('The seed value must be numeric.');
    }

    return 'RAND('.(int) $seed.')';
  }

  /**
   * Compile the lock into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  bool|string  $value
   * @return string
   */
  protected compileLock(query: Builder, $value) {
    if (!is_string($value)) {
      return $value ? 'for update' : 'lock in share mode';
    }

    return $value;
  }

  /**
   * Compile an insert statement into SQL.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  public compileInsert(query: Builder, array $values) {
    if (empty($values)) {
      $values = [[]];
    }

    return parent.compileInsert($query, $values);
  }

  /**
   * Compile the columns for an update statement.
   *
   * @param  \Illuminate\Database\Query\Builder  $query
   * @param  array  $values
   * @return string
   */
  protected compileUpdateColumns(query: Builder, array $values) {
    return (new Collection($values)) -> map(function ($value, $key) {
      if (this.isJsonSelector($key)) {
        return this.compileJsonUpdateColumn($key, $value);
      }

      return this.wrap($key).' = '.this.parameter($value);
    }) -> implode(', ');
  }

//   /**
//    * Compile an "upsert" statement into SQL.
//    *
//    * @param  \Illuminate\Database\Query\Builder  $query
//    * @param  array  $values
//    * @param  array  $uniqueBy
//    * @param  array  $update
//    * @return string
//    */
//   public compileUpsert(query: Builder, array $values, array $uniqueBy, array $update) {
//     $useUpsertAlias = $query -> connection -> getConfig('use_upsert_alias');

//     $sql = this.compileInsert($query, $values);

//     if ($useUpsertAlias) {
//       $sql.= ' as laravel_upsert_alias';
//     }

//     $sql.= ' on duplicate key update ';

//     $columns = (new Collection($update)) -> map(function ($value, $key) use($useUpsertAlias) {
//       if(!is_numeric($key)) {
//       return this.wrap($key).' = '.this.parameter($value);
//     }

//     return $useUpsertAlias
//       ? this.wrap($value).' = '.this.wrap('laravel_upsert_alias').'.'.this.wrap($value)
//                 : this.wrap($value).' = values('.this.wrap($value).')';
//   })-> implode(', ');

// return $sql.$columns;
//     }

// /**
//  * Compile a "lateral join" clause.
//  *
//  * @param  \Illuminate\Database\Query\JoinLateralClause  $join
//  * @param  string  $expression
//  * @return string
//  */
// public compileJoinLateral(JoinLateralClause $join, string $expression): string {
//   return trim("{$join->type} join lateral {$expression} on true");
// }

// /**
//  * {@inheritdoc}
//  */
// protected supportsStraightJoins() {
//   return true;
// }

// /**
//  * Prepare a JSON column being updated using the JSON_SET.
//  *
//  * @param  string  $key
//  * @param  mixed  $value
//  * @return string
//  */
// protected compileJsonUpdateColumn($key, $value) {
//   if (is_bool($value)) {
//     $value = $value ? 'true' : 'false';
//   } elseif(is_array($value)) {
//     $value = 'cast(? as json)';
//   } else {
//     $value = this.parameter($value);
//   }

//   [$field, $path] = this.wrapJsonFieldAndPath($key);

//   return "{$field} = json_set({$field}{$path}, {$value})";
// }

// /**
//  * Compile an update statement without joins into SQL.
//  *
//  * @param  \Illuminate\Database\Query\Builder  $query
//  * @param  string  $table
//  * @param  string  $columns
//  * @param  string  $where
//  * @return string
//  */
// protected compileUpdateWithoutJoins(query: Builder, $table, $columns, $where) {
//   $sql = parent.compileUpdateWithoutJoins($query, $table, $columns, $where);

//   if (!empty($query -> orders)) {
//     $sql.= ' '.this.compileOrders($query, $query -> orders);
//   }

//   if (isset($query -> limit)) {
//     $sql.= ' '.this.compileLimit($query, $query -> limit);
//   }

//   return $sql;
// }

//     /**
//      * Prepare the bindings for an update statement.
//      *
//      * Booleans, integers, and doubles are inserted into JSON updates as raw values.
//      *
//      * @param  array  $bindings
//      * @param  array  $values
//      * @return array
//      */
//     #[\Override]
// public prepareBindingsForUpdate(array $bindings, array $values) {
//   $values = (new Collection($values))
//     -> reject(fn($value, $column) => this.isJsonSelector($column) && is_bool($value))
//     -> map(fn($value) => is_array($value) ? json_encode($value) : $value)
//     -> all();

//   return parent.prepareBindingsForUpdate($bindings, $values);
// }

// /**
//  * Compile a delete statement without joins into SQL.
//  *
//  * @param  \Illuminate\Database\Query\Builder  $query
//  * @param  string  $table
//  * @param  string  $where
//  * @return string
//  */
// protected compileDeleteWithoutJoins(query: Builder, $table, $where) {
//   $sql = parent.compileDeleteWithoutJoins($query, $table, $where);

//   if (!empty($query -> orders)) {
//     $sql.= ' '.this.compileOrders($query, $query -> orders);
//   }

//   if (isset($query -> limit)) {
//     $sql.= ' '.this.compileLimit($query, $query -> limit);
//   }

//   return $sql;
// }

// /**
//  * Compile a delete statement with joins into SQL.
//  *
//  * Adds ORDER BY and LIMIT if present, for platforms that allow them (e.g., PlanetScale).
//  *
//  * Standard MySQL does not support ORDER BY or LIMIT with joined deletes and will throw a syntax error.
//  *
//  * @param  \Illuminate\Database\Query\Builder  $query
//  * @param  string  $table
//  * @param  string  $where
//  * @return string
//  */
// protected compileDeleteWithJoins(query: Builder, $table, $where) {
//   $sql = parent.compileDeleteWithJoins($query, $table, $where);

//   if (!empty($query -> orders)) {
//     $sql.= ' '.this.compileOrders($query, $query -> orders);
//   }

//   if (isset($query -> limit)) {
//     $sql.= ' '.this.compileLimit($query, $query -> limit);
//   }

//   return $sql;
// }

// /**
//  * Compile a query to get the number of open connections for a database.
//  *
//  * @return string
//  */
// public compileThreadCount() {
//   return 'select variable_value as `Value` from performance_schema.session_status where variable_name = \'threads_connected\'';
// }

// /**
//  * Wrap a single string in keyword identifiers.
//  *
//  * @param  string  $value
//  * @return string
//  */
// protected wrapValue($value) {
//   return $value === '*' ? $value : '`'.str_replace('`', '``', $value).'`';
// }

// /**
//  * Wrap the given JSON selector.
//  *
//  * @param  string  $value
//  * @return string
//  */
// protected wrapJsonSelector($value) {
//   [$field, $path] = this.wrapJsonFieldAndPath($value);

//   return 'json_unquote(json_extract('.$field.$path.'))';
// }

// /**
//  * Wrap the given JSON selector for boolean values.
//  *
//  * @param  string  $value
//  * @return string
//  */
// protected wrapJsonBooleanSelector($value) {
//   const [field, path] = this.swrapJsonFieldAndPath(value);

//   return 'json_extract(' + field + path + ')';
// }
}
