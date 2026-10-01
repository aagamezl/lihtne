export class ForwardsCalls {
  /**
    /**
     * Throw a bad method call exception for the given method.
     *
     * @param  string  $method
     * @return never
     *
     * @throws \BadMethodCallException
     */
  protected throwBadMethodCallException (method: string): never {
    throw new Error(`BadMethodCallException: Call to undefined method ${this.constructor.name}::${method}()`)
  }
}
