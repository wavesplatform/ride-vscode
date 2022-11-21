export const getCharacter = (text: string, offset: number) => {
    if (text.match(/: $/gi)) {
        return text.substring(offset - 2, offset - 1);
    } else return text.substring(offset - 1, offset)
}
