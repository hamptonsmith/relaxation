# Filters

filters: {
	filterName1: {
		operators: {
			opname1: {
				toMongo: value => mongoQuery
			},
			...
			opnameN: { ... }
		},
		parseValue: (str) => value
	},
	...
	filterNameN: { ... }
}