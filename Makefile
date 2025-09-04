NAME=pretty-git-diff

.PHONY: all deps compile package install clean

all: deps compile package install

deps:
	npm install

compile:
	npm run compile

package:
	npm run package

install:
	code --install-extension $(NAME)-$(shell node -pe "require('./package.json').version").vsix

clean:
	rm -f $(NAME)-*.vsix
