export interface Cursors {
  all: number[]
  posts: {
    all: number[]
    ja: number[]
  }
  likes: {
    all: string[]
    ja: string[]
  }
}

export interface Posters {
  all: {
    [date: string]: string[] //Set<string>
  }
  jp: {
    [date: string]: string[] //Set<string>
  }
}

export interface imageData {
  title: string
  buffer: Buffer
  aspectRatio: {
    width: number
    height: number
  }
}
