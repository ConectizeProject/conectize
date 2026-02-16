'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'

export function DocumentMaskedInput(props: { name: string, defaultValue?: string, placeholder?: string }) {
	const initial = useMemo(() => formatCpfCnpj(String(props.defaultValue || '')), [props.defaultValue])
	const [value, setValue] = useState(initial)

	return (
		<Input
			name={props.name}
			value={value}
			onChange={(e) => setValue(formatCpfCnpj(e.target.value))}
			placeholder={props.placeholder}
			inputMode="numeric"
		/>
	)
}

