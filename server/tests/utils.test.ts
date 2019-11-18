import {
    getNodeByOffset,
    getNodeDefinitionByName,
    isIGetter,
    isILet,
    offsetToRange,
    rangeToOffset
} from "../src/utils";
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
    const offset = 246, line = 5, character = 15;

    const range = offsetToRange(offset, content);
    expect(range).toStrictEqual({line, character});
    expect(rangeToOffset(range.line, range.character, content)).toBe(offset);

    const o = rangeToOffset(line, character, content);
    expect(o).toBe(offset);
    expect(offsetToRange(o, content)).toStrictEqual({line, character});
});


test('test getNodeByOffset', () => {
    const parsedDoc = parseAndCompile(content);
    expect(isIGetter(getNodeByOffset(parsedDoc.exprAst, 350))).toBe(true)
})

test('test getNodeDefinitionByName', () => {
    const parsedDoc = parseAndCompile(content);
    expect(isILet(getNodeDefinitionByName(parsedDoc.exprAst, 'bobPubKey', 300))).toBe(true)
})
