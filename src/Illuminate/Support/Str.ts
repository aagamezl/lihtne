export class Str {
  public static between(subject: string, from: string, to: string): string {
    if (from === '' || to === '') {
      return subject;
    }

    return this.beforeLast(this.after(subject, from), to);
  }

  public static beforeLast(subject: string, search: string): string {
    if (search === '') {
      return subject;
    }

    const pos = subject.lastIndexOf(search);

    if (pos === -1) {
      return subject;
    }

    return this.substr(subject, 0, pos);
  }

  public static substr(
    string: string,
    start: number,
    length?: number | null,
    _encoding = 'UTF-8',
  ): string {
    return length == null
      ? string.slice(start)
      : string.slice(start, start + length);
  }

  public static after(subject: string, search: string): string {
    if (search === '') {
      return subject;
    }

    const position = subject.indexOf(search);

    return position === -1
      ? subject
      : subject.slice(position + search.length);
  }
}
