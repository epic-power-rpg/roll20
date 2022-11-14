development-config:
	mkdir -p .git/hooks
	ln -nsf ../../githooks/pre-commit .git/hooks/pre-commit

