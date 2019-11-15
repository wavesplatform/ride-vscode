import { getNodeByOffset, offsetToRange, rangeToOffset } from "../src/utils";
import { parseAndCompile } from "@waves/ride-js";

const content = `{-# STDLIB_VERSION 3 #-}
{-# CONTENT_TYPE EXPRESSION #-}
{-# SCRIPT_TYPE ACCOUNT #-} 
let alicePubKey  = base58'5AzfA9UfpWVYiwFwvdr77k6LWupSTGLb14b24oVdEpMM'
let bobPubKey    = base58'2KwU4vzdgPmKyf7q354H9kSyX9NZjNiq4qbnH2wi2VDF'
let cooperPubKey = base58'GbrUeGaBfmyFJjSQb9Z8uTCej5GzjXfRDVGJGrmgt5cD'
func aliceSigned  () = if(sigVerify(tx.bodyBytes, tx.proofs[0], alicePubKey  )) then 1 else 0
func bobSigned    () = if(sigVerify(tx.bodyBytes, tx.proofs[1], bobPubKey    )) then 1 else 0

func cooperSigned () = if(sigVerify(tx.bodyBytes, tx.proofs[2], cooperPubKey )) then 1 else 0
aliceSigned() + bobSigned() + cooperSigned() >= 2 `;

test('test rangeToOffset and offsetToRange', () => {
    const offset = 246, row = 5, col = 15;

    const range = offsetToRange(offset, content);
    expect(range).toStrictEqual({row, col});
    expect(rangeToOffset(range.row, range.col, content)).toBe(offset);

    const o = rangeToOffset(row, col, content);
    expect(o).toBe(offset);
    expect(offsetToRange(o, content)).toStrictEqual({row, col});
});

test('test', () => {
    const position = {line: 10, character: 39};
    const parsedDoc = parseAndCompile(content);
    const node = getNodeByOffset(parsedDoc.exprAst, rangeToOffset(position.line, position.character, content));
    console.log(node)
    // console.log( node.posStart, offsetToRange( node.posStart, text))
    // console.log( node.posEnd, offsetToRange( node.posEnd, text))

})
