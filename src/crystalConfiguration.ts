'use strict';

export const crystalConfiguration = {
	// Add indentation rules for crystal language
	indentationRules: {
		// /^.*(
		//       ((
		//         ((if|elsif|lib|fun|module|struct|class|def|macro|do|rescue)\s)|
		//         (end\.)
		//       ).*)|
		//       ((begin|else|ensure|do|rescue)\b)
		//     )
		// $/
		increaseIndentPattern: /^.*(((((if|elsif|lib|fun|module|struct|class|def|macro|do|rescue)\s)|(end\.)).*)|((begin|else|ensure|do|rescue)\b))$/,
		// /^\s*(
		//        ((rescue|ensure|else)\b)|
		//        (elsif\s.*)|
		//        (end(\..*|\b))
		//      )
		// $/
		decreaseIndentPattern: /^\s*(((rescue|ensure|else)\b)|(elsif\s.*)|(end(\..*|\b)))$/
	}
}